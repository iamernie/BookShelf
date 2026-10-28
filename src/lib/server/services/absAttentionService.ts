/**
 * Audiobookshelf sync attention queue: the items a human has to decide on
 *
 *   ambiguous_match - several books (or a title-only hit with another author) could be this item
 *   duplicate_link  - several books link the same item; "Keep this one" unlinks the others
 *   deleted_book    - tombstone for a deleted linked book, so the sync doesn't re-create it
 *
 * Rows are written by sync runs (absSyncService) and by deleteBook; resolved here.
 */

import { db } from '$lib/server/db';
import { absSyncAttention, books, type AbsSyncAttention } from '$lib/server/db/schema';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { applyAbsTagParity, describeError, getAbsConfig, getAbsItemOrNull, isUsable } from './absService';
import { createBookFromItem, getSyncReadiness, resolveAttention } from './absSyncService';
import type { MatchCandidate } from './absMatch';
import { notifyBookAdded } from './notificationService';
import { createLogger } from './loggerService';
import { env } from '$env/dynamic/private';

const log = createLogger('abs-sync');

export type AttentionStatus = 'open' | 'ignored' | 'resolved';
export type AttentionView = Omit<AbsSyncAttention, 'candidates'> & { candidates: MatchCandidate[] };

function toView(row: AbsSyncAttention): AttentionView {
	let candidates: MatchCandidate[] = [];
	try {
		candidates = JSON.parse(row.candidates) as MatchCandidate[];
	} catch {
		candidates = [];
	}
	return { ...row, candidates };
}

export async function listAttention(status: AttentionStatus): Promise<AttentionView[]> {
	const rows = await db.select().from(absSyncAttention)
		.where(eq(absSyncAttention.status, status))
		.orderBy(desc(absSyncAttention.updatedAt), desc(absSyncAttention.id))
		.limit(500);
	return rows.map(toView);
}

export type AttentionAction =
	| { action: 'link'; bookId: number }
	| { action: 'keep'; bookId: number }
	| { action: 'create' }
	| { action: 'ignore' }
	| { action: 'reopen' };

export type AttentionActionResult =
	| { ok: true; item: AttentionView | null; book?: { id: number; title: string } }
	| { ok: false; status: 400 | 404 | 409 | 503; message: string };

async function getRow(id: number): Promise<AbsSyncAttention | null> {
	const [row] = await db.select().from(absSyncAttention).where(eq(absSyncAttention.id, id)).limit(1);
	return row ?? null;
}

async function linkedBookFor(absItemId: string, exceptBookId?: number): Promise<{ id: number; title: string } | null> {
	const [row] = await db.select({ id: books.id, title: books.title }).from(books)
		.where(and(eq(books.absItemId, absItemId), exceptBookId === undefined ? undefined : ne(books.id, exceptBookId)))
		.limit(1);
	return row ?? null;
}

/** Apply one admin decision. 503 while sync is off or not configured (listing still works). */
export async function applyAttentionAction(id: number, input: AttentionAction, userId: number): Promise<AttentionActionResult> {
	const ready = await getSyncReadiness();
	if (!ready.ok) return { ok: false, status: 503, message: ready.message };

	const row = await getRow(id);
	if (!row) return { ok: false, status: 404, message: 'Attention item not found' };

	switch (input.action) {
		case 'ignore': {
			if (row.status !== 'open') return { ok: false, status: 409, message: 'Only open items can be ignored' };
			await resolveAttention(row.id, 'ignored', null, userId);
			return { ok: true, item: toView((await getRow(row.id))!) };
		}

		case 'reopen': {
			if (row.status !== 'ignored') return { ok: false, status: 409, message: 'Only ignored items can be reopened' };
			// A deleted book's tombstone just goes away: the next sync matches or creates the item again
			if (row.kind === 'deleted_book') {
				await db.delete(absSyncAttention).where(eq(absSyncAttention.id, row.id));
				return { ok: true, item: null };
			}
			try {
				await db.update(absSyncAttention).set({
					status: 'open',
					resolution: null,
					resolvedAt: null,
					resolvedBy: null,
					updatedAt: new Date().toISOString()
				}).where(eq(absSyncAttention.id, row.id));
			} catch {
				return { ok: false, status: 409, message: 'This item already has an open entry' };
			}
			return { ok: true, item: toView((await getRow(row.id))!) };
		}

		case 'link': {
			if (row.status !== 'open' || row.kind !== 'ambiguous_match') return { ok: false, status: 409, message: 'Only open ambiguous matches can be linked' };
			const [book] = await db.select({ id: books.id, title: books.title, absItemId: books.absItemId }).from(books).where(eq(books.id, input.bookId)).limit(1);
			if (!book) return { ok: false, status: 404, message: 'Book not found' };
			if (book.absItemId && book.absItemId !== row.absItemId) {
				return { ok: false, status: 409, message: 'That book is already linked to another Audiobookshelf item' };
			}
			const other = await linkedBookFor(row.absItemId, book.id);
			if (other) return { ok: false, status: 409, message: `This Audiobookshelf item is already linked to "${other.title}"` };

			await db.update(books)
				.set({ absItemId: row.absItemId, absLinkStaleAt: null, updatedAt: new Date().toISOString() })
				.where(eq(books.id, book.id));
			await applyAbsTagParity(book.id);
			await resolveAttention(row.id, 'linked', book.id, userId);
			log.info('Linked Audiobookshelf item from the attention queue', { absItemId: row.absItemId, bookId: book.id });
			return { ok: true, item: toView((await getRow(row.id))!), book: { id: book.id, title: book.title } };
		}

		case 'create': {
			if (row.status !== 'open' || row.kind !== 'ambiguous_match') return { ok: false, status: 409, message: 'Only open ambiguous matches can be created' };
			const other = await linkedBookFor(row.absItemId);
			if (other) return { ok: false, status: 409, message: `This Audiobookshelf item is already linked to "${other.title}"` };

			let item;
			try {
				item = await getAbsItemOrNull(ready.config, row.absItemId);
			} catch (err) {
				return { ok: false, status: 503, message: describeError(err) };
			}
			if (!item) return { ok: false, status: 409, message: 'This item no longer exists on Audiobookshelf' };

			const created = await createBookFromItem(ready.owner.id, item);
			await resolveAttention(row.id, 'created', created.id, userId);
			const origin = env.ORIGIN?.replace(/\/+$/, '') || undefined;
			notifyBookAdded(ready.owner.id, { id: created.id, title: created.title, author: created.author ?? undefined }, origin)
				.catch((err) => log.warn('Book added notification failed', { error: err instanceof Error ? err.message : String(err) }));
			return { ok: true, item: toView((await getRow(row.id))!), book: { id: created.id, title: created.title } };
		}

		case 'keep': {
			if (row.status !== 'open' || row.kind !== 'duplicate_link') return { ok: false, status: 409, message: 'Only open duplicate links can be kept' };
			const [book] = await db.select({ id: books.id, title: books.title, absItemId: books.absItemId }).from(books).where(eq(books.id, input.bookId)).limit(1);
			if (!book || book.absItemId !== row.absItemId) return { ok: false, status: 409, message: 'That book is not linked to this item' };

			const others = await db.select({ id: books.id }).from(books)
				.where(and(eq(books.absItemId, row.absItemId), ne(books.id, book.id)));
			for (const o of others) {
				await db.update(books).set({ absItemId: null, absLinkStaleAt: null, updatedAt: new Date().toISOString() }).where(eq(books.id, o.id));
				await applyAbsTagParity(o.id);
			}
			await resolveAttention(row.id, 'kept', book.id, userId);
			retryUniqueIndex();
			log.info('Resolved duplicate Audiobookshelf link', { absItemId: row.absItemId, keptBookId: book.id, unlinked: others.length });
			return { ok: true, item: toView((await getRow(row.id))!), book: { id: book.id, title: book.title } };
		}
	}
}

/** The one-to-one index; fails harmlessly while other duplicate links remain. */
function retryUniqueIndex(): void {
	try {
		db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS books_absItemId_unique ON books(absItemId) WHERE absItemId IS NOT NULL`);
	} catch {
		// Other duplicates remain; the next sync run retries
	}
}

/**
 * Re-check one book's link with a single GET: found clears the stale flag, a 404 sets it.
 * Needs only the integration (not the sync toggle). Any other error is reported, never flagged.
 */
export async function verifyBookLink(bookId: number): Promise<
	| { ok: true; found: boolean; staleCleared: boolean; staleSet: boolean }
	| { ok: false; status: 400 | 404 | 503; message: string }
> {
	const config = await getAbsConfig();
	if (!isUsable(config)) return { ok: false, status: 503, message: 'Audiobookshelf integration is disabled or not configured' };

	const [book] = await db.select({ id: books.id, absItemId: books.absItemId, absLinkStaleAt: books.absLinkStaleAt })
		.from(books).where(eq(books.id, bookId)).limit(1);
	if (!book) return { ok: false, status: 404, message: 'Book not found' };
	if (!book.absItemId) return { ok: false, status: 400, message: 'Book is not linked to Audiobookshelf' };

	let found: boolean;
	try {
		found = (await getAbsItemOrNull(config, book.absItemId)) !== null;
	} catch (err) {
		return { ok: false, status: 503, message: describeError(err) };
	}

	const staleCleared = found && !!book.absLinkStaleAt;
	const staleSet = !found && !book.absLinkStaleAt;
	if (staleCleared || staleSet) {
		await db.update(books).set({ absLinkStaleAt: staleSet ? new Date().toISOString() : null }).where(eq(books.id, book.id));
	}
	return { ok: true, found, staleCleared, staleSet };
}
