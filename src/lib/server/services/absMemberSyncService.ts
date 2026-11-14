/**
 * Per-member Audiobookshelf listening sync (2.36.0, card 134)
 *
 * Runs inside every site sync run, after the catalog passes (so an item first seen this run is
 * already linked or born), replacing the old site-key status pass. For each connection whose member
 * turned "Sync my listening" on, in userId order: their own key's GET /api/me, identity check, then
 * every book progress record that is NEW (lastUpdate past the item's watermark, or past the
 * connection's baseline when there is none) is acted on once:
 *
 *   target   finished -> Done; else currentTime >= 5 min -> Current; else nothing (watermark advances)
 *   link     exactly one non-stale book linked to the item, else `unlinked` (watermark held, S7)
 *   held     the member's own row: advance-only (Done is final; Current stays Current) - mirror
 *   own copy not held, but the member holds a different book with the item's exact ASIN/ISBN:
 *            mirror onto that copy, never linking it (S13)
 *   auto-add not held: only an ownerless or public book (B2). Anything else is `notReachable` and the
 *            watermark is held, so a later promote picks the listening up (S12, D9)
 *
 * Only statusId, startReadingDate and completedDate move (applyStatusChange, source abs_sync). A
 * missing lastUpdate is skipped and logged, never "new"; a failed write and every preview leave the
 * watermark where it was (S8). Run-child rows carry book ids only, never titles (N8).
 */

import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db, migrateAbsSiteConnection } from '$lib/server/db';
import { absMemberItemState, absSyncMemberRuns, absUserConnections, books, userBooks, users, type AbsUserConnection } from '$lib/server/db/schema';
import { AbsHttpError, describeError, getAbsConfig, type AbsConfig, type AbsMediaProgress } from './absService';
import { normalizeAsin, normalizeIsbn } from './absMatch';
import {
	bookProgress,
	connectionKey,
	fetchAbsMe,
	getConnection,
	getSiteAbsUserId,
	isSyncRunning,
	markError,
	memberWorkHolder,
	rebindSiteConnection,
	releaseMemberWork,
	tryHoldMemberWork
} from './absConnectionService';
import { applyStatusChange, getStatusByKey } from './statusService';
import { notifyAbsConnectionProblem } from './notificationService';
import { createLogger } from './loggerService';
import { dateInAppTz, todayInAppTz } from '$lib/server/utils/appTime';

const log = createLogger('abs-members');

/** D4: an accidental open is not listening */
export const LISTEN_THRESHOLD_SEC = 300;
const DETAILS_CAP = 200;
/** Errors the member is told about once, when they first appear */
const NOTIFY_ERRORS = new Set(['key_rejected', 'identity_changed', 'decrypt_failed']);

export interface ItemIdents {
	asin: string | null;
	isbn: string | null;
}

export interface MemberPassInput {
	runId: number;
	preview: boolean;
	config: AbsConfig;
	/** Exact identifiers of the items seen by this run's scan (own-copy guard) */
	itemIdents: Map<string, ItemIdents>;
}

export interface MemberPassResult {
	members: number;
	/** Status changes on members' rows: mirror flips + auto-adds (the parent run's statusFlips) */
	statusChanges: number;
	failedMembers: { userId: number; error: string }[];
}

export interface MemberDetail {
	action: 'status' | 'auto_added' | 'failed' | 'no_timestamp';
	bookId?: number;
	to?: 'READ' | 'CURRENT';
}

interface MemberOutcome {
	status: 'succeeded' | 'partial' | 'failed' | 'skipped';
	progressSeen: number;
	statusFlips: number;
	autoAdded: number;
	notReachable: number;
	unlinked: number;
	error: string | null;
	details: MemberDetail[];
}

const emptyOutcome = (): MemberOutcome => ({
	status: 'succeeded', progressSeen: 0, statusFlips: 0, autoAdded: 0, notReachable: 0, unlinked: 0, error: null, details: []
});

// ABS timestamps are epoch ms; book reading dates are YYYY-MM-DD in the app timezone
function toDateOnly(epochMs: number | null | undefined): string {
	return epochMs ? dateInAppTz(epochMs) : todayInAppTz();
}

const hasTimestamp = (p: AbsMediaProgress): p is AbsMediaProgress & { lastUpdate: number } =>
	typeof p.lastUpdate === 'number' && Number.isFinite(p.lastUpdate) && p.lastUpdate > 0;

// ============================================
// Shared lookups
// ============================================

interface LinkedBook {
	id: number;
	ownerId: number | null;
	libraryType: string | null;
	absLinkStaleAt: string | null;
	absWritebackItemId: string | null;
	asin: string | null;
	isbn10: string | null;
	isbn13: string | null;
}

/** Every linked book by item id: an array, since the unique index is deferred while duplicates exist */
async function loadLinkedBooks(): Promise<Map<string, LinkedBook[]>> {
	const rows = await db.select({
		id: books.id, absItemId: books.absItemId, ownerId: books.ownerId, libraryType: books.libraryType,
		absLinkStaleAt: books.absLinkStaleAt, absWritebackItemId: books.absWritebackItemId,
		asin: books.asin, isbn10: books.isbn10, isbn13: books.isbn13
	}).from(books).where(isNotNull(books.absItemId));
	const map = new Map<string, LinkedBook[]>();
	for (const { absItemId, ...b } of rows) {
		const list = map.get(absItemId as string);
		if (list) list.push(b);
		else map.set(absItemId as string, [b]);
	}
	return map;
}

interface MemberLibrary {
	statusByBook: Map<number, number | null>;
	byAsin: Map<string, number[]>;
	byIsbn: Map<string, number[]>;
}

/** The member's own rows (held = permanent reach), indexed by exact identifiers for the own-copy guard */
async function loadMemberLibrary(userId: number): Promise<MemberLibrary> {
	const rows = await db.select({ bookId: userBooks.bookId, statusId: userBooks.statusId, asin: books.asin, isbn10: books.isbn10, isbn13: books.isbn13 })
		.from(userBooks).innerJoin(books, eq(books.id, userBooks.bookId))
		.where(eq(userBooks.userId, userId))
		.orderBy(asc(userBooks.bookId));
	const lib: MemberLibrary = { statusByBook: new Map(), byAsin: new Map(), byIsbn: new Map() };
	const push = (m: Map<string, number[]>, k: string | null, id: number) => {
		if (!k) return;
		const list = m.get(k) ?? [];
		if (!list.includes(id)) list.push(id);
		m.set(k, list);
	};
	for (const r of rows) {
		lib.statusByBook.set(r.bookId, r.statusId);
		push(lib.byAsin, normalizeAsin(r.asin), r.bookId);
		push(lib.byIsbn, normalizeIsbn(r.isbn13), r.bookId);
		push(lib.byIsbn, normalizeIsbn(r.isbn10), r.bookId);
	}
	return lib;
}

// ============================================
// One member's progress
// ============================================

interface ProcessOptions {
	preview: boolean;
	/**
	 * History import: every progress record counts, not only new ones, and only books the member
	 * doesn't hold are added (a held book's status, a DNF set by hand included, is never moved by
	 * old listening)
	 */
	waiveNew: boolean;
	itemIdents: Map<string, ItemIdents>;
	linked: Map<string, LinkedBook[]>;
	/** Applies the historical write-back guard (S1) for the site key's identity only */
	siteAbsUserId: string | null;
	statuses: { done: number | null; current: number | null };
}

async function advance(userId: number, p: AbsMediaProgress & { lastUpdate: number }, bookId: number | null): Promise<void> {
	const now = new Date().toISOString();
	await db.insert(absMemberItemState)
		.values({ userId, absItemId: p.libraryItemId, lastActedUpdate: p.lastUpdate, lastActedFinished: p.isFinished ? 1 : 0, bookId, updatedAt: now })
		.onConflictDoUpdate({
			target: [absMemberItemState.userId, absMemberItemState.absItemId],
			set: { lastActedUpdate: p.lastUpdate, lastActedFinished: p.isFinished ? 1 : 0, bookId, updatedAt: now }
		});
}

/** The own copy for an item the member doesn't hold: exact ASIN or ISBN only, and only when unambiguous */
function findOwnCopy(lib: MemberLibrary, idents: ItemIdents[], exclude: number): number | null {
	const hits = new Set<number>();
	for (const id of idents) {
		for (const b of (id.asin ? lib.byAsin.get(id.asin) : undefined) ?? []) if (b !== exclude) hits.add(b);
		for (const b of (id.isbn ? lib.byIsbn.get(id.isbn) : undefined) ?? []) if (b !== exclude) hits.add(b);
	}
	return hits.size === 1 ? [...hits][0] : null;
}

async function processProgress(conn: AbsUserConnection, progress: AbsMediaProgress[], opts: ProcessOptions, out: MemberOutcome): Promise<void> {
	const userId = conn.userId;
	const { done, current } = opts.statuses;
	const [wmRows, lib] = await Promise.all([
		db.select().from(absMemberItemState).where(eq(absMemberItemState.userId, userId)),
		loadMemberLibrary(userId)
	]);
	const watermark = new Map(wmRows.map((w) => [w.absItemId, w]));
	const detail = (d: MemberDetail) => {
		if (out.details.length < DETAILS_CAP) out.details.push(d);
	};

	for (const p of bookProgress(progress)) {
		out.progressSeen++;
		if (!hasTimestamp(p)) {
			// Never "new" without a timestamp: skipping is the only safe answer
			log.warn('Audiobookshelf progress without lastUpdate skipped', { userId, absItemId: p.libraryItemId });
			detail({ action: 'no_timestamp' });
			continue;
		}
		if (!opts.waiveNew) {
			const wm = watermark.get(p.libraryItemId);
			const isNew = wm ? p.lastUpdate > wm.lastActedUpdate : conn.baselineAt !== null && p.lastUpdate > conn.baselineAt;
			if (!isNew) continue;
		}

		const target = p.isFinished ? done : (p.currentTime ?? 0) >= LISTEN_THRESHOLD_SEC ? current : null;
		const candidates = opts.linked.get(p.libraryItemId) ?? [];
		if (candidates.length !== 1 || candidates[0].absLinkStaleAt) {
			// Not linked, linked twice, or stale: held until it is placed
			out.unlinked++;
			continue;
		}
		const book = candidates[0];
		if (target === null) {
			if (!opts.preview) await advance(userId, p, book.id);
			continue;
		}

		const held = lib.statusByBook.has(book.id) || book.ownerId === userId;
		if (held && opts.waiveNew) continue;
		let targetBook = book.id;
		let adding = false;
		if (!held) {
			const scanned = opts.itemIdents.get(p.libraryItemId);
			const idents: ItemIdents[] = [
				{ asin: normalizeAsin(book.asin), isbn: normalizeIsbn(book.isbn13) ?? normalizeIsbn(book.isbn10) },
				...(scanned ? [scanned] : [])
			];
			const copy = findOwnCopy(lib, idents, book.id);
			if (copy !== null) {
				if (opts.waiveNew) continue;
				targetBook = copy;
			} else if (book.ownerId === null || book.libraryType === 'public') {
				adding = true;
			} else {
				// Private (or only shared): never auto-added, and the watermark waits for a promote
				out.notReachable++;
				continue;
			}
		}

		const statusNow = lib.statusByBook.get(targetBook) ?? null;
		const nothingToDo =
			(!adding && statusNow !== null && statusNow === done) || // Done is final
			(!adding && target === current && statusNow === current) ||
			// Historical guard (pre-2.23 write-back finished this item itself) for the site key's user only
			(target === done && targetBook === book.id && book.absWritebackItemId === p.libraryItemId
				&& opts.siteAbsUserId !== null && conn.absUserId === opts.siteAbsUserId);
		if (nothingToDo) {
			if (!opts.preview) await advance(userId, p, book.id);
			continue;
		}

		const to = target === done ? 'READ' : 'CURRENT';
		if (opts.preview) {
			if (adding) out.autoAdded++;
			else out.statusFlips++;
			detail({ action: adding ? 'auto_added' : 'status', bookId: targetBook, to });
			continue;
		}

		const stampDates: { startReadingDate?: string; completedDate?: string } = {};
		if (p.startedAt) stampDates.startReadingDate = toDateOnly(p.startedAt);
		if (target === done) stampDates.completedDate = toDateOnly(p.finishedAt);
		try {
			const res = await applyStatusChange([targetBook], target, { source: 'abs_sync', userId, stampDates, userBooksOnly: true });
			if (res.changed.length > 0) {
				if (res.userBooksCreated > 0) out.autoAdded++;
				else out.statusFlips++;
				detail({ action: res.userBooksCreated > 0 ? 'auto_added' : 'status', bookId: targetBook, to });
				lib.statusByBook.set(targetBook, target);
			}
			await advance(userId, p, book.id);
		} catch (err) {
			// The watermark stays: the next run tries again
			out.status = 'partial';
			detail({ action: 'failed', bookId: targetBook });
			log.warn('Audiobookshelf listening write failed', { userId, bookId: targetBook, error: describeError(err) });
		}
	}
}

// ============================================
// The pass (inside a site run)
// ============================================

async function statusIds(): Promise<{ done: number | null; current: number | null }> {
	const [done, current] = await Promise.all([getStatusByKey('READ'), getStatusByKey('CURRENT')]);
	return { done: done?.id ?? null, current: current?.id ?? null };
}

async function recordError(conn: AbsUserConnection, code: string, preview: boolean): Promise<void> {
	if (preview || conn.lastError === code) return;
	await markError(conn.userId, code);
	if (NOTIFY_ERRORS.has(code)) {
		const origin = env.ORIGIN?.replace(/\/+$/, '') || undefined;
		await notifyAbsConnectionProblem(conn.userId, code, origin).catch((err) =>
			log.warn('Audiobookshelf connection notification failed', { userId: conn.userId, error: err instanceof Error ? err.message : String(err) })
		);
	}
}

async function writeChild(runId: number, userId: number, o: MemberOutcome): Promise<void> {
	await db.insert(absSyncMemberRuns).values({
		runId,
		userId,
		status: o.status,
		progressSeen: o.progressSeen,
		statusFlips: o.statusFlips,
		autoAdded: o.autoAdded,
		notReachable: o.notReachable,
		unlinked: o.unlinked,
		error: o.error,
		details: o.details.length > 0 ? JSON.stringify(o.details) : null
	});
}

async function processMember(conn: AbsUserConnection, input: MemberPassInput, shared: Omit<ProcessOptions, 'preview' | 'waiveNew' | 'itemIdents'>): Promise<MemberOutcome> {
	const out = emptyOutcome();
	const fail = async (code: string) => {
		out.status = 'failed';
		out.error = code;
		await recordError(conn, code, input.preview);
		return out;
	};

	const key = connectionKey(conn, input.config);
	if (!key.ok) return fail(key.error);

	let me;
	try {
		me = await fetchAbsMe(input.config.baseUrl, key.apiKey);
	} catch (err) {
		if (err instanceof AbsHttpError && (err.status === 401 || err.status === 403)) return fail('key_rejected');
		out.status = 'failed';
		out.error = describeError(err); // network trouble: no notification, the next run retries
		return out;
	}
	// The key now speaks for someone else: nothing of theirs may act (B1)
	if (me.id !== conn.absUserId) return fail('identity_changed');

	await processProgress(conn, me.progress, { ...shared, preview: input.preview, waiveNew: false, itemIdents: input.itemIdents }, out);

	if (!input.preview) {
		const now = new Date().toISOString();
		await db.update(absUserConnections)
			.set({ lastSyncAt: now, ...(conn.lastError ? { lastError: null, lastErrorAt: null } : {}), updatedAt: now })
			.where(eq(absUserConnections.id, conn.id));
	}
	return out;
}

/**
 * Every opted-in member's new listening, once per site run. Never throws for one member: a member
 * that fails is recorded on its child row and makes the run partial, never failed.
 */
export async function memberListeningPass(input: MemberPassInput): Promise<MemberPassResult> {
	const result: MemberPassResult = { members: 0, statusChanges: 0, failedMembers: [] };
	const statuses = await statusIds();
	if (statuses.done === null && statuses.current === null) {
		log.warn('No READ or CURRENT status found; member listening sync skipped');
		return result;
	}

	// A key + owner set since boot: move the retired setting now (no-op once migrated)
	if (!input.preview) {
		try {
			migrateAbsSiteConnection();
		} catch (err) {
			log.warn('Audiobookshelf owner connection migration failed', { error: describeError(err) });
		}
	}

	// Pending site rows first, so no member is processed while an identity is unknown (S2)
	const pending = await db.select().from(absUserConnections)
		.where(and(eq(absUserConnections.keySource, 'site'), sql`${absUserConnections.absUserId} IS NULL`));
	const settled = new Set<number>();
	for (const row of pending) {
		if (input.preview) {
			settled.add(row.userId);
			await writeChild(input.runId, row.userId, { ...emptyOutcome(), status: 'skipped', error: 'pending' });
			continue;
		}
		const bound = await rebindSiteConnection(row.userId, null);
		if (!bound.ok) {
			settled.add(row.userId);
			const conflict = bound.code === 'identity_conflict';
			await writeChild(input.runId, row.userId, { ...emptyOutcome(), status: conflict ? 'skipped' : 'failed', error: bound.code });
			if (!conflict) result.failedMembers.push({ userId: row.userId, error: bound.code });
		}
		// Bound now: baseline = this moment's listening, so this run finds nothing new for it
	}

	const conns = await db.select({ conn: absUserConnections })
		.from(absUserConnections)
		.innerJoin(users, eq(users.id, absUserConnections.userId))
		.where(and(
			eq(absUserConnections.syncListening, 1),
			isNotNull(absUserConnections.absUserId),
			sql`COALESCE(${users.role}, 'member') != 'guest'`,
			sql`COALESCE(${users.approvalStatus}, 'approved') = 'approved'`
		))
		.orderBy(asc(absUserConnections.userId));
	const active = conns.map((c) => c.conn).filter((c) => !settled.has(c.userId));
	if (active.length === 0) return result;

	const site = await db.select({ absUserId: absUserConnections.absUserId }).from(absUserConnections).where(eq(absUserConnections.keySource, 'site')).limit(1);
	const siteAbsUserId = site[0]?.absUserId ?? (await getSiteAbsUserId(input.config));
	const linked = await loadLinkedBooks();

	for (const conn of active) {
		// identity_conflict needs an admin's Re-bind; no ABS call until then
		if (conn.lastError === 'identity_conflict') {
			await writeChild(input.runId, conn.userId, { ...emptyOutcome(), status: 'skipped', error: 'identity_conflict' });
			continue;
		}
		result.members++;
		let out: MemberOutcome;
		try {
			out = await processMember(conn, input, { linked, siteAbsUserId, statuses });
		} catch (err) {
			out = { ...emptyOutcome(), status: 'failed', error: describeError(err) };
			log.warn('Audiobookshelf member sync failed', { userId: conn.userId, error: out.error });
		}
		result.statusChanges += out.statusFlips + out.autoAdded;
		if (out.status === 'failed' || out.status === 'partial') result.failedMembers.push({ userId: conn.userId, error: out.error ?? 'some writes failed' });
		await writeChild(input.runId, conn.userId, out);
	}
	return result;
}

// ============================================
// History import (the member's explicit Add, S5)
// ============================================

export type ImportResult =
	| { ok: true; preview: boolean; added: number; changed: number; unplaced: number }
	| { ok: false; status: 404 | 409 | 502 | 503; code: string; message: string };

const BUSY: ImportResult = { ok: false, status: 409, code: 'sync_running', message: 'An Audiobookshelf sync is running. Try again in a minute.' };

/**
 * "Add what I've already listened to": the pass's rules with the newness test waived, because the
 * member asks for it, and adds only (books already held keep their status). Preview counts only. No abs_sync_runs row (the schedule anchor is
 * untouched); refuses while a run is active, and holds the in-process mutex the scheduler checks.
 */
export async function importListeningHistory(userId: number, opts: { preview: boolean }): Promise<ImportResult> {
	const config = await getAbsConfig();
	if (!config.enabled || !config.baseUrl) return { ok: false, status: 503, code: 'abs_unavailable', message: 'Audiobookshelf is not set up on this server' };
	const conn = await getConnection(userId);
	if (!conn || !conn.absUserId) return { ok: false, status: 404, code: 'not_connected', message: 'Connect your Audiobookshelf account first' };
	if (conn.lastError === 'identity_changed' || conn.lastError === 'identity_conflict') {
		return { ok: false, status: 409, code: conn.lastError, message: 'Fix your Audiobookshelf connection first' };
	}

	const holder = `import:${userId}:${Date.now()}`;
	if (!opts.preview) {
		if (memberWorkHolder() !== null || (await isSyncRunning())) return BUSY;
		if (!tryHoldMemberWork(holder)) return BUSY;
		// A run may have started between the check and the hold
		if (await isSyncRunning()) {
			releaseMemberWork(holder);
			return BUSY;
		}
	}
	try {
		const key = connectionKey(conn, config);
		if (!key.ok) return { ok: false, status: 503, code: key.error, message: "Your saved key can't be used. Replace it first." };
		let me;
		try {
			me = await fetchAbsMe(config.baseUrl, key.apiKey);
		} catch (err) {
			return { ok: false, status: 502, code: 'abs_unreachable', message: `Couldn't reach Audiobookshelf: ${describeError(err)}` };
		}
		if (me.id !== conn.absUserId) return { ok: false, status: 409, code: 'identity_changed', message: 'Your key now belongs to a different Audiobookshelf account' };

		const site = await db.select({ absUserId: absUserConnections.absUserId }).from(absUserConnections).where(eq(absUserConnections.keySource, 'site')).limit(1);
		const out = emptyOutcome();
		await processProgress(conn, me.progress, {
			preview: opts.preview,
			waiveNew: true,
			itemIdents: new Map(),
			linked: await loadLinkedBooks(),
			siteAbsUserId: site[0]?.absUserId ?? null,
			statuses: await statusIds()
		}, out);
		if (!opts.preview) log.info('Audiobookshelf listening history imported', { userId, added: out.autoAdded, changed: out.statusFlips });
		return { ok: true, preview: opts.preview, added: out.autoAdded, changed: out.statusFlips, unplaced: out.unlinked + out.notReachable };
	} finally {
		if (!opts.preview) releaseMemberWork(holder);
	}
}

/** Child rows of a run for the admin view (book ids only) */
export async function getMemberRuns(runId: number) {
	const rows = await db.select({ row: absSyncMemberRuns, username: users.username })
		.from(absSyncMemberRuns)
		.innerJoin(users, eq(users.id, absSyncMemberRuns.userId))
		.where(eq(absSyncMemberRuns.runId, runId))
		.orderBy(asc(absSyncMemberRuns.userId));
	return rows.map(({ row, username }) => {
		let details: MemberDetail[] = [];
		try {
			details = row.details ? (JSON.parse(row.details) as MemberDetail[]) : [];
		} catch {
			details = [];
		}
		return { ...row, username, details };
	});
}

/** Member-run counts for several runs (the run list) */
export async function getMemberRunTotals(runIds: number[]): Promise<Map<number, { members: number; autoAdded: number }>> {
	const out = new Map<number, { members: number; autoAdded: number }>();
	if (runIds.length === 0) return out;
	const rows = await db.select({ runId: absSyncMemberRuns.runId, members: sql<number>`COUNT(*)`, autoAdded: sql<number>`COALESCE(SUM(${absSyncMemberRuns.autoAdded}), 0)` })
		.from(absSyncMemberRuns).where(inArray(absSyncMemberRuns.runId, runIds)).groupBy(absSyncMemberRuns.runId);
	for (const r of rows) out.set(r.runId, { members: r.members, autoAdded: r.autoAdded });
	return out;
}
