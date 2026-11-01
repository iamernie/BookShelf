/**
 * Ebook Hash Service
 *
 * Tracks every KOReader document hash that belongs to a book. books.ebookMd5 is a mirror
 * meaning "partial MD5 of the current file"; matching reads book_ebook_hashes only, so a
 * device holding an older copy of a replaced file still links to the same book.
 */

import { db } from '$lib/server/db';
import { bookEbookHashes, books, koreaderProgress, userBooks } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { canReachBook } from './libraryShareService';

export type EbookHashSource =
	| 'legacy'
	| 'upload'
	| 'import'
	| 'bookdrop'
	| 'rehash'
	| 'manual_link'
	| 'merge';

/**
 * Remember a hash for a book. Returns true if it was not already known.
 */
export async function rememberEbookHash(
	bookId: number,
	hash: string,
	source: EbookHashSource
): Promise<boolean> {
	const result = await db
		.insert(bookEbookHashes)
		.values({ bookId, hash, source, createdAt: new Date().toISOString() })
		.onConflictDoNothing();

	return result.changes > 0;
}

/**
 * Record the hash of a book's current file: remembers it and moves the mirror.
 * Nothing is deleted, older hashes stay matchable.
 */
export async function setCurrentEbookHash(
	bookId: number,
	hash: string,
	source: EbookHashSource
): Promise<{ added: boolean; mirrorChanged: boolean }> {
	const added = await rememberEbookHash(bookId, hash, source);

	const [book] = await db
		.select({ ebookMd5: books.ebookMd5 })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	const mirrorChanged = book?.ebookMd5 !== hash;
	if (mirrorChanged) {
		await db
			.update(books)
			.set({ ebookMd5: hash, updatedAt: new Date().toISOString() })
			.where(eq(books.id, bookId));
	}

	return { added, mirrorChanged };
}

/**
 * Find the book a document hash belongs to, for this user.
 * Only books the user can reach qualify; owned books rank first, then the user's library,
 * then the rest, lowest id breaking ties. A hash can sit on several books because the same
 * file can be in two users' libraries.
 */
export async function findBookForHash(userId: number, hash: string): Promise<number | null> {
	const candidates = await db
		.select({ id: books.id, ownerId: books.ownerId })
		.from(bookEbookHashes)
		.innerJoin(books, eq(bookEbookHashes.bookId, books.id))
		.where(eq(bookEbookHashes.hash, hash));

	const reachable: typeof candidates = [];
	for (const candidate of candidates) {
		if (await canReachBook(userId, candidate.id)) {
			reachable.push(candidate);
		}
	}

	if (reachable.length === 0) {
		return null;
	}

	const inLibrary = await db
		.select({ bookId: userBooks.bookId })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), inArray(userBooks.bookId, reachable.map((b) => b.id))));
	const libraryIds = new Set(inLibrary.map((row) => row.bookId));

	const rank = (book: { id: number; ownerId: number | null }) =>
		book.ownerId === userId ? 0 : libraryIds.has(book.id) ? 1 : 2;

	return [...reachable].sort((a, b) => rank(a) - rank(b) || a.id - b.id)[0].id;
}

/**
 * Move a merged book's hashes and linked KOReader progress to the surviving book.
 * Every hash moves, whichever book keeps a file: devices holding the loser's copy still link.
 * Runs before the source is deleted, whose ON DELETE SET NULL would unlink the progress rows.
 */
export function carryEbookHashes(sourceId: number, targetId: number): void {
	const now = new Date().toISOString();

	db.transaction((tx) => {
		const hashes = tx
			.select({ hash: bookEbookHashes.hash })
			.from(bookEbookHashes)
			.where(eq(bookEbookHashes.bookId, sourceId))
			.all();

		for (const { hash } of hashes) {
			tx.insert(bookEbookHashes)
				.values({ bookId: targetId, hash, source: 'merge', createdAt: now })
				.onConflictDoNothing()
				.run();
		}

		tx.delete(bookEbookHashes).where(eq(bookEbookHashes.bookId, sourceId)).run();

		tx.update(koreaderProgress)
			.set({ bookId: targetId, updatedAt: now })
			.where(eq(koreaderProgress.bookId, sourceId))
			.run();
	});
}

/**
 * Forget a removed ebook's hashes and unlink its KOReader progress, which keeps its position:
 * re-uploading the same file relinks on the next push. A row left linked would keep writing
 * to a book with no ebook.
 */
export function clearEbookHashes(bookId: number): void {
	const now = new Date().toISOString();

	db.transaction((tx) => {
		tx.delete(bookEbookHashes).where(eq(bookEbookHashes.bookId, bookId)).run();

		tx.update(koreaderProgress)
			.set({ bookId: null, updatedAt: now })
			.where(eq(koreaderProgress.bookId, bookId))
			.run();
	});
}

/**
 * Forget a link the user took back, so the next push doesn't redo it. Covers manual links and
 * legacy hashes, because the old link route stored device hashes in the mirror and those
 * backfilled as legacy. The current file's own hash always stays.
 */
export async function forgetManualHash(bookId: number, hash: string): Promise<void> {
	const [book] = await db
		.select({ ebookMd5: books.ebookMd5 })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (book?.ebookMd5 === hash) {
		return;
	}

	await db
		.delete(bookEbookHashes)
		.where(
			and(
				eq(bookEbookHashes.bookId, bookId),
				eq(bookEbookHashes.hash, hash),
				inArray(bookEbookHashes.source, ['manual_link', 'legacy'])
			)
		);
}
