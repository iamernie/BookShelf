/**
 * Audiobookshelf item sync (2.23.0)
 *
 * Two entry points share one lock: Sync Now (POST /api/admin/abs/sync, manual) and the
 * in-app scheduler (scheduled). Every run is one abs_sync_runs row; the partial unique
 * index on status='running' is the lock across requests, and the in-process flag below
 * catches concurrent requests first.
 *
 * Passes, in order:
 *   1. Setup   - retry the absItemId unique index; open duplicate_link rows for items linked twice
 *   2. Scan    - every item of the audiobook library, page by page
 *   3. Match   - ASIN, ISBN, title, core, base (absMatch); one hit links, several queue
 *   4. Create  - born-linked books owned by the sync owner, tagged Audiobook Shelf + Auto-Added
 *   5. Push    - series (and optionally author/narrator) into BLANK ABS fields only
 *   6. Stale   - only after a complete scan; a link is stale only on a confirmed 404
 *   7. Status  - (toggle) ABS progress → BookShelf status, by status key, advance-only
 *   8. Tags    - "Audiobook Shelf" tag parity
 *
 * Matching and status sync only see the owner's books, books in the owner's library and
 * public books. Preview runs write nothing but the run row and attention rows.
 */

import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	absSyncAttention,
	absSyncRuns,
	authors,
	bookAuthors,
	bookSeries,
	books,
	formats,
	narrators,
	series,
	userBooks,
	users,
	type AbsSyncAttention,
	type AbsSyncRun
} from '$lib/server/db/schema';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import {
	ABS_PAGE_SIZE,
	absPatchItemMedia,
	describeError,
	ensureAbsTag,
	ensureAudioFormat,
	ensureAutoAddedTag,
	fetchProgressByItem,
	getAbsConfig,
	getAbsItemOrNull,
	getAudioFormatIds,
	getLibraries,
	getLibraryItemsPage,
	getUnreadStatusId,
	healAbsTags,
	itemNarrators,
	itemTitle,
	pickAudiobookLibrary,
	toAbsProgress,
	type AbsConfig,
	type AbsExpandedItem,
	type AbsLibraryItem,
	type AbsMediaProgress
} from './absService';
import {
	addToMatchIndex,
	buildMatchIndex,
	cleanTitle,
	matchItem,
	nameKey,
	normalizeAsin,
	normalizeIsbn,
	seriesSequence,
	splitNames,
	type MatchBook,
	type MatchCandidate,
	type MatchIndex,
	type MatchItem
} from './absMatch';
import { createBook } from './bookService';
import { applyStatusChange, getStatusByKey } from './statusService';
import { getSetting, getSettingAs, ABS_SYNC_INTERVALS } from './settingsService';
import { notifyBookAdded, sendNotification, sendSystemNotification } from './notificationService';
import { createLogger } from './loggerService';
import { dateInAppTz, todayInAppTz } from '$lib/server/utils/appTime';

const log = createLogger('abs-sync');

export const SCHEDULER_TICK_MS = 60_000;
const DEFAULT_INTERVAL_MINUTES = 360;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
const ALERT_AFTER_FAILURES = 3;
const DETAILS_CAP_PER_ACTION = 200;
const NOTIFY_PER_BOOK_MAX = 10;
const RUN_KEEP_COUNT = 500;
const RUN_KEEP_DAYS = 90;
const ABANDONED_ERROR = 'Server restarted during sync';

export type SyncMode = 'apply' | 'preview';
export type SyncTrigger = 'manual' | 'scheduled';

// ============================================
// In-process state (survives dev HMR via globalThis)
// ============================================

interface SyncState {
	activeRunId: number | null;
	activePromise: Promise<void> | null;
	bootAt: number;
	lastNotReadyMessage: string | null;
}

const STATE_KEY = Symbol.for('bookshelf.absSync');
const SCHEDULER_KEY = Symbol.for('bookshelf.absSyncScheduler');
type SyncGlobal = typeof globalThis & {
	[STATE_KEY]?: SyncState;
	[SCHEDULER_KEY]?: ReturnType<typeof setInterval>;
};

function state(): SyncState {
	const g = globalThis as SyncGlobal;
	g[STATE_KEY] ??= { activeRunId: null, activePromise: null, bootAt: Date.now(), lastNotReadyMessage: null };
	return g[STATE_KEY];
}

/** Resolves when the in-flight run (if any) has finished. For tests and shutdown. */
export function waitForActiveRun(): Promise<void> {
	return state().activePromise ?? Promise.resolve();
}

// ============================================
// Configuration
// ============================================

export interface SyncOwner {
	id: number;
	username: string;
}

/** The configured owner, only when it is an existing admin or librarian (an empty setting parses to NaN). */
export async function resolveSyncOwner(): Promise<SyncOwner | null> {
	const id = parseInt((await getSetting('integration.abs_owner_user_id')).trim(), 10);
	if (!Number.isInteger(id) || id <= 0) return null;
	const [user] = await db.select({ id: users.id, username: users.username, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
	if (!user || (user.role !== 'admin' && user.role !== 'librarian')) return null;
	return { id: user.id, username: user.username };
}

export async function getSyncIntervalMinutes(): Promise<number> {
	const minutes = await getSettingAs<number>('integration.abs_sync_interval_minutes', 'number');
	return (ABS_SYNC_INTERVALS as readonly number[]).includes(minutes) ? minutes : DEFAULT_INTERVAL_MINUTES;
}

type Readiness = { ok: true; config: AbsConfig; owner: SyncOwner } | { ok: false; message: string };

async function checkReadiness(): Promise<Readiness> {
	const [config, syncEnabled] = await Promise.all([
		getAbsConfig(),
		getSettingAs<boolean>('integration.abs_sync_enabled', 'boolean')
	]);
	if (!config.enabled || !syncEnabled) {
		return { ok: false, message: 'Audiobookshelf sync is disabled. Turn it on in Admin → Settings → Integrations.' };
	}
	if (!config.baseUrl || !config.apiKey) return { ok: false, message: 'Audiobookshelf URL or API key is not set' };
	const owner = await resolveSyncOwner();
	if (!owner) return { ok: false, message: 'Sync owner not set. Choose an admin or librarian in Admin → Settings → Integrations.' };
	return { ok: true, config, owner };
}

// ============================================
// Run records
// ============================================

export interface RunDetail {
	pass: 'setup' | 'match' | 'create' | 'pushback' | 'stale' | 'status';
	action: string;
	absItemId?: string;
	title?: string;
	bookId?: number;
	tier?: string;
	reason?: string;
	fields?: string[];
}

export type SyncRunView = Omit<AbsSyncRun, 'details'> & { details?: RunDetail[] };

function toRunView(row: AbsSyncRun, withDetails: boolean): SyncRunView {
	const { details, ...rest } = row;
	if (!withDetails) return rest;
	let parsed: RunDetail[] = [];
	if (details) {
		try {
			parsed = JSON.parse(details) as RunDetail[];
		} catch {
			parsed = [];
		}
	}
	return { ...rest, details: parsed };
}

/** Mark rows left 'running' by a dead process. One process, so at boot every running row is dead. */
export async function recoverAbandonedRuns(): Promise<number> {
	const now = new Date().toISOString();
	const result = await db.update(absSyncRuns)
		.set({ status: 'abandoned', error: ABANDONED_ERROR, finishedAt: now })
		.where(eq(absSyncRuns.status, 'running'));
	if (result.changes > 0) log.warn('Marked interrupted Audiobookshelf sync runs abandoned', { runs: result.changes });
	return result.changes;
}

export async function listRuns(opts: { limit?: number; before?: number } = {}): Promise<SyncRunView[]> {
	const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 20) || 20));
	const rows = await db.select().from(absSyncRuns)
		.where(opts.before ? lt(absSyncRuns.id, opts.before) : undefined)
		.orderBy(desc(absSyncRuns.id))
		.limit(limit);
	return rows.map((r) => toRunView(r, false));
}

export async function getRun(id: number): Promise<SyncRunView | null> {
	const [row] = await db.select().from(absSyncRuns).where(eq(absSyncRuns.id, id)).limit(1);
	return row ? toRunView(row, true) : null;
}

async function getRunningRun(): Promise<AbsSyncRun | null> {
	const [row] = await db.select().from(absSyncRuns).where(eq(absSyncRuns.status, 'running')).limit(1);
	return row ?? null;
}

// ============================================
// Starting a run
// ============================================

export type StartSyncResult =
	| { ok: true; run: SyncRunView }
	| { ok: false; status: 409 | 503; message: string; details?: { runId: number; startedAt: string; trigger: string } };

// drizzle wraps driver errors ("Failed to run the query ..."); the SQLite reason is on the cause
function isUniqueViolation(err: unknown): boolean {
	for (let e: unknown = err; e instanceof Error; e = (e as Error & { cause?: unknown }).cause) {
		if ((e as Error & { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint/i.test(e.message)) return true;
	}
	return false;
}

function busyResult(row: AbsSyncRun | null): StartSyncResult {
	return {
		ok: false,
		status: 409,
		message: 'An Audiobookshelf sync is already running',
		details: row ? { runId: row.id, startedAt: row.startedAt, trigger: row.triggerType } : undefined
	};
}

/**
 * Start a run in the background. Never throws for ABS problems: those end up in the run row.
 * 503 (no row written) when sync is off or not configured; 409 when a run is in flight.
 */
export async function startSync(opts: { mode: SyncMode; trigger: SyncTrigger; userId?: number | null }): Promise<StartSyncResult> {
	const ready = await checkReadiness();
	if (!ready.ok) return { ok: false, status: 503, message: ready.message };

	const st = state();
	if (st.activeRunId !== null) return busyResult(await getRunningRun());

	let row: AbsSyncRun;
	try {
		[row] = await db.insert(absSyncRuns).values({
			triggerType: opts.trigger,
			mode: opts.mode,
			status: 'running',
			triggeredBy: opts.userId ?? null,
			startedAt: new Date().toISOString()
		}).returning();
	} catch (err) {
		// Unique index on status='running': another process holds the lock
		if (isUniqueViolation(err)) return busyResult(await getRunningRun());
		throw err;
	}

	st.activeRunId = row.id;
	st.activePromise = executeRun(row, ready.config, ready.owner).finally(() => {
		st.activeRunId = null;
		st.activePromise = null;
	});

	return { ok: true, run: toRunView(row, false) };
}

// ============================================
// Run context
// ============================================

interface CreatedBook {
	id: number;
	title: string;
	author: string | null;
}

class RunContext {
	linked = 0;
	created = 0;
	pushed = 0;
	skipped = 0;
	failed = 0;
	queued = 0;
	staleFound = 0;
	staleCleared = 0;
	statusFlips = 0;
	itemsScanned = 0;
	scanComplete = false;
	libraryId: string | null = null;
	details: RunDetail[] = [];
	createdBooks: CreatedBook[] = [];
	/** Author/narrator/format/tag lookups shared by every create in the run */
	createCache: CreateCache = {};
	private perAction = new Map<string, number>();
	private nextPreviewId = -1;

	constructor(
		readonly run: AbsSyncRun,
		readonly config: AbsConfig,
		readonly owner: SyncOwner
	) {}

	get preview(): boolean {
		return this.run.mode === 'preview';
	}

	previewBookId(): number {
		return this.nextPreviewId--;
	}

	detail(d: RunDetail): void {
		const n = this.perAction.get(d.action) ?? 0;
		this.perAction.set(d.action, n + 1);
		if (n < DETAILS_CAP_PER_ACTION) this.details.push(d);
	}

	fail(d: Omit<RunDetail, 'action'>, err: unknown): void {
		this.failed++;
		const reason = describeError(err);
		this.detail({ ...d, action: 'failed', reason });
		log.warn('Audiobookshelf sync step failed', { runId: this.run.id, pass: d.pass, absItemId: d.absItemId, bookId: d.bookId, error: reason });
	}

	counters() {
		return {
			itemsScanned: this.itemsScanned,
			scanComplete: this.scanComplete,
			libraryId: this.libraryId,
			linked: this.linked,
			created: this.created,
			pushed: this.pushed,
			skipped: this.skipped,
			failed: this.failed,
			queued: this.queued,
			staleFound: this.staleFound,
			staleCleared: this.staleCleared,
			statusFlips: this.statusFlips
		};
	}
}

async function executeRun(run: AbsSyncRun, config: AbsConfig, owner: SyncOwner): Promise<void> {
	const ctx = new RunContext(run, config, owner);
	const started = Date.parse(run.startedAt);
	let status: 'succeeded' | 'partial' | 'failed' = 'succeeded';
	let error: string | null = null;

	try {
		await runPasses(ctx);
		status = ctx.failed > 0 ? 'partial' : 'succeeded';
	} catch (err) {
		status = 'failed';
		error = describeError(err);
		log.error('Audiobookshelf sync failed', { runId: run.id, error });
	}

	try {
		const finishedAt = new Date().toISOString();
		await db.update(absSyncRuns).set({
			...ctx.counters(),
			status,
			error,
			finishedAt,
			durationMs: Date.now() - started,
			details: ctx.details.length > 0 ? JSON.stringify(ctx.details) : null
		}).where(eq(absSyncRuns.id, run.id));
		log.info('Audiobookshelf sync finished', { runId: run.id, mode: run.mode, trigger: run.triggerType, status, ...ctx.counters() });

		if (!ctx.preview) await notifyCreated(ctx);
		if (run.triggerType === 'scheduled' && run.mode === 'apply' && status === 'failed') await maybeAlert(run.id, error);
		await pruneRuns();
	} catch (err) {
		log.error('Failed to record Audiobookshelf sync result', { runId: run.id, error: err instanceof Error ? err.message : String(err) });
	}
}

async function persistProgress(ctx: RunContext): Promise<void> {
	await db.update(absSyncRuns).set(ctx.counters()).where(eq(absSyncRuns.id, ctx.run.id));
}

// ============================================
// Passes
// ============================================

interface ScannedItem {
	id: string;
	/** null = the scan shape didn't say (treated as possibly blank; the pre-PATCH re-read decides) */
	hasSeries: boolean | null;
	hasAuthors: boolean | null;
	hasNarrators: boolean | null;
}

async function runPasses(ctx: RunContext): Promise<void> {
	await setupPass(ctx);

	const library = pickAudiobookLibrary(await getLibraries(ctx.config));
	if (!library) throw new Error('No libraries found on Audiobookshelf');
	ctx.libraryId = library.id;

	const scope = await loadScope(ctx.owner.id);
	const scanned = await scanAndMatchPass(ctx, library.id, scope);
	await persistProgress(ctx);

	await pushbackPass(ctx, scope, scanned);
	if (ctx.scanComplete) await stalePass(ctx, scanned);

	if (await getSettingAs<boolean>('integration.abs_sync_status', 'boolean')) await statusPass(ctx, scope);

	if (!ctx.preview) {
		const healed = await healAbsTags(await ensureAbsTag());
		if (healed.added || healed.removed) log.info('Healed Audiobook Shelf tag drift', healed);
	}
}

/** Unique index retry + duplicate links. Attention rows only, so it runs in preview too. */
async function setupPass(ctx: RunContext): Promise<void> {
	const dupes = await db
		.select({ absItemId: books.absItemId })
		.from(books)
		.where(isNotNull(books.absItemId))
		.groupBy(books.absItemId)
		.having(sql`COUNT(*) > 1`);

	if (dupes.length === 0) {
		try {
			db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS books_absItemId_unique ON books(absItemId) WHERE absItemId IS NOT NULL`);
		} catch (err) {
			log.warn('Could not create the books.absItemId unique index', { error: describeError(err) });
		}
	}

	const dupIds = dupes.map((d) => d.absItemId as string);
	const now = new Date().toISOString();

	// Duplicate rows whose item is linked once again resolve themselves
	await db.update(absSyncAttention)
		.set({ status: 'resolved', resolution: 'auto', resolvedAt: now, updatedAt: now })
		.where(and(
			eq(absSyncAttention.kind, 'duplicate_link'),
			eq(absSyncAttention.status, 'open'),
			dupIds.length ? notInArray(absSyncAttention.absItemId, dupIds) : undefined
		));

	for (const absItemId of dupIds) {
		const linkedBooks = await db.select({ id: books.id, title: books.title, formatId: books.formatId })
			.from(books).where(eq(books.absItemId, absItemId)).orderBy(asc(books.id));
		const candidates: MatchCandidate[] = [];
		for (const b of linkedBooks) {
			candidates.push({ bookId: b.id, title: b.title, author: await primaryAuthorName(b.id), formatName: await formatName(b.formatId), tier: 'title', linkedTo: absItemId });
		}
		await upsertOpenAttention(ctx.run.id, {
			absItemId,
			kind: 'duplicate_link',
			itemTitle: linkedBooks[0]?.title ?? null,
			tier: null,
			candidates
		});
		ctx.detail({ pass: 'setup', action: 'duplicate_link', absItemId, title: linkedBooks[0]?.title, reason: `${linkedBooks.length} books share this item` });
	}
}

interface Scope {
	index: MatchIndex;
	/** Books the owner owns (status sync moves books.statusId for these) */
	ownedIds: Set<number>;
	/** Books by id, for pushback and status sync */
	byId: Map<number, MatchBook>;
	/** Every linked item id in the whole database, any owner: never re-created */
	linkedItemIds: Set<string>;
	ignoredItemIds: Set<string>;
	openAttention: Map<string, AbsSyncAttention>;
}

async function loadScope(ownerId: number): Promise<Scope> {
	const ownerLibrary = db.select({ bookId: userBooks.bookId }).from(userBooks).where(eq(userBooks.userId, ownerId));
	const [rows, formatRows, audioIds, allLinked, attentionRows] = await Promise.all([
		db.select({
			id: books.id,
			title: books.title,
			asin: books.asin,
			isbn10: books.isbn10,
			isbn13: books.isbn13,
			absItemId: books.absItemId,
			formatId: books.formatId,
			ownerId: books.ownerId
		}).from(books).where(or(eq(books.ownerId, ownerId), eq(books.libraryType, 'public'), inArray(books.id, ownerLibrary))),
		db.select({ id: formats.id, name: formats.name }).from(formats),
		getAudioFormatIds(),
		db.select({ absItemId: books.absItemId }).from(books).where(isNotNull(books.absItemId)),
		db.select().from(absSyncAttention).where(inArray(absSyncAttention.status, ['open', 'ignored']))
	]);

	const formatNames = new Map(formatRows.map((f) => [f.id, f.name]));
	const audio = new Set(audioIds);
	const authorsByBook = await loadAuthorNames(rows.map((r) => r.id));

	const matchBooks: MatchBook[] = rows.map((r) => ({
		id: r.id,
		title: r.title,
		asin: r.asin,
		isbn10: r.isbn10,
		isbn13: r.isbn13,
		absItemId: r.absItemId,
		isAudio: r.formatId !== null && audio.has(r.formatId),
		formatName: r.formatId !== null ? formatNames.get(r.formatId) ?? null : null,
		authors: authorsByBook.get(r.id) ?? []
	}));

	const openAttention = new Map<string, AbsSyncAttention>();
	const ignoredItemIds = new Set<string>();
	for (const a of attentionRows) {
		if (a.status === 'open') openAttention.set(a.absItemId, a);
		else ignoredItemIds.add(a.absItemId);
	}

	return {
		index: buildMatchIndex(matchBooks),
		ownedIds: new Set(rows.filter((r) => r.ownerId === ownerId).map((r) => r.id)),
		byId: new Map(matchBooks.map((b) => [b.id, b])),
		linkedItemIds: new Set(allLinked.map((r) => r.absItemId as string)),
		ignoredItemIds,
		openAttention
	};
}

/** Author names per book in display order, from bookauthors (never the legacy books.authorId) */
async function loadAuthorNames(bookIds: number[]): Promise<Map<number, string[]>> {
	const byBook = new Map<number, string[]>();
	if (bookIds.length === 0) return byBook;
	const rows = await db
		.select({ bookId: bookAuthors.bookId, name: authors.name })
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.orderBy(asc(bookAuthors.displayOrder), asc(bookAuthors.id));
	const wanted = new Set(bookIds);
	for (const r of rows) {
		if (!wanted.has(r.bookId)) continue;
		const list = byBook.get(r.bookId);
		if (list) list.push(r.name);
		else byBook.set(r.bookId, [r.name]);
	}
	return byBook;
}

async function primaryAuthorName(bookId: number): Promise<string | null> {
	const [row] = await db.select({ name: authors.name }).from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, bookId))
		.orderBy(asc(bookAuthors.displayOrder), asc(bookAuthors.id))
		.limit(1);
	return row?.name ?? null;
}

async function formatName(formatId: number | null): Promise<string | null> {
	if (formatId === null) return null;
	const [row] = await db.select({ name: formats.name }).from(formats).where(eq(formats.id, formatId)).limit(1);
	return row?.name ?? null;
}

export function toMatchItem(item: AbsLibraryItem | AbsExpandedItem): MatchItem {
	const meta = item.media?.metadata;
	const authorNames = meta?.authors?.length
		? meta.authors.map((a) => a.name.trim()).filter(Boolean)
		: splitNames(meta?.authorName);
	return {
		id: item.id,
		title: itemTitle(item),
		asin: meta?.asin?.trim() || null,
		isbn: meta?.isbn?.trim() || null,
		authors: authorNames,
		authorName: meta?.authorName?.trim() || null
	};
}

function describeScanned(item: AbsLibraryItem): ScannedItem {
	const meta = item.media?.metadata;
	const has = (arr: unknown[] | undefined, str: string | null | undefined): boolean | null => {
		if (arr !== undefined) return arr.length > 0 || !!str?.trim();
		if (str !== undefined && str !== null) return !!str.trim();
		return null;
	};
	return {
		id: item.id,
		hasSeries: has(meta?.series, meta?.seriesName),
		hasAuthors: has(meta?.authors, meta?.authorName),
		hasNarrators: has(meta?.narrators, meta?.narratorName)
	};
}

async function scanAndMatchPass(ctx: RunContext, libraryId: string, scope: Scope): Promise<Map<string, ScannedItem>> {
	const scanned = new Map<string, ScannedItem>();

	for (let page = 0; ; page++) {
		const { results, total } = await getLibraryItemsPage(ctx.config, libraryId, page);
		if (results.length === 0) break;

		for (const item of results) {
			if (scanned.has(item.id)) continue;
			ctx.itemsScanned++;
			scanned.set(item.id, describeScanned(item));
			try {
				await handleItem(ctx, scope, item);
			} catch (err) {
				ctx.fail({ pass: 'match', absItemId: item.id, title: itemTitle(item) }, err);
			}
		}

		await persistProgress(ctx);
		if ((page + 1) * ABS_PAGE_SIZE >= total) break;
	}

	ctx.scanComplete = true;
	return scanned;
}

async function handleItem(ctx: RunContext, scope: Scope, item: AbsLibraryItem): Promise<void> {
	// Pre-scan: a linked item is never matched or re-created, whatever its title says now
	if (scope.linkedItemIds.has(item.id)) {
		const open = scope.openAttention.get(item.id);
		if (open && open.kind === 'ambiguous_match') {
			await resolveAttention(open.id, 'auto', null, null);
			scope.openAttention.delete(item.id);
		}
		return;
	}
	if (scope.ignoredItemIds.has(item.id)) {
		ctx.skipped++;
		return;
	}
	const open = scope.openAttention.get(item.id);
	if (open) {
		await db.update(absSyncAttention)
			.set({ lastSeenRunId: ctx.run.id, updatedAt: new Date().toISOString() })
			.where(eq(absSyncAttention.id, open.id));
		ctx.skipped++;
		return;
	}

	const mi = toMatchItem(item);
	if (!mi.title) {
		ctx.skipped++;
		return;
	}

	const result = matchItem(mi, scope.index);
	const base = { absItemId: item.id, title: mi.title };

	switch (result.kind) {
		case 'link': {
			const book = scope.byId.get(result.bookId);
			if (!ctx.preview) {
				await db.update(books)
					.set({ absItemId: item.id, absLinkStaleAt: null, updatedAt: new Date().toISOString() })
					.where(and(eq(books.id, result.bookId), isNull(books.absItemId)));
			}
			if (book) book.absItemId = item.id;
			scope.linkedItemIds.add(item.id);
			ctx.linked++;
			ctx.detail({ pass: 'match', action: 'linked', ...base, bookId: result.bookId, tier: result.tier });
			return;
		}
		case 'queue': {
			await upsertOpenAttention(ctx.run.id, {
				absItemId: item.id,
				kind: 'ambiguous_match',
				itemTitle: mi.title,
				itemAuthor: mi.authors.join(', ') || mi.authorName,
				itemNarrator: itemNarrators(item).join(', ') || null,
				itemAsin: normalizeAsin(mi.asin),
				itemIsbn: mi.isbn,
				tier: result.tier,
				candidates: result.candidates
			});
			ctx.queued++;
			ctx.detail({ pass: 'match', action: 'queued', ...base, tier: result.tier, reason: result.reason });
			return;
		}
		case 'skip':
			ctx.skipped++;
			ctx.detail({ pass: 'match', action: 'skipped', ...base, tier: result.tier, reason: result.reason, bookId: result.candidates[0]?.bookId });
			return;
		case 'create': {
			let bookId: number;
			if (ctx.preview) {
				bookId = ctx.previewBookId();
			} else {
				const created = await createBookFromItem(ctx.owner.id, item, ctx.createCache);
				bookId = created.id;
				ctx.createdBooks.push(created);
			}
			addToMatchIndex(scope.index, {
				id: bookId,
				title: cleanTitle(mi.title),
				asin: mi.asin,
				isbn10: null,
				isbn13: normalizeIsbn(mi.isbn),
				absItemId: item.id,
				isAudio: true,
				formatName: null,
				authors: mi.authors
			});
			scope.linkedItemIds.add(item.id);
			ctx.created++;
			ctx.detail({
				pass: 'create',
				action: 'created',
				...base,
				bookId: bookId > 0 ? bookId : undefined,
				reason: result.note ?? undefined
			});
		}
	}
}

// ============================================
// Born-linked create
// ============================================

export interface CreateCache {
	authorIds?: Map<string, number>;
	narratorIds?: Map<string, number>;
	formatId?: number;
	statusId?: number | null;
	tagIds?: number[];
}

async function keyedIds(table: typeof authors | typeof narrators): Promise<Map<string, number>> {
	const rows = await db.select({ id: table.id, name: table.name }).from(table).orderBy(asc(table.id));
	const map = new Map<string, number>();
	for (const r of rows) {
		const key = nameKey(r.name);
		if (key && !map.has(key)) map.set(key, r.id);
	}
	return map;
}

/** Author/narrator rows by name key, so 'J.N. Chaney' reuses 'J. N. Chaney' */
async function ensurePerson(table: typeof authors | typeof narrators, cache: Map<string, number>, name: string): Promise<number> {
	const key = nameKey(name);
	const existing = cache.get(key);
	if (existing !== undefined) return existing;
	const now = new Date().toISOString();
	const [created] = await db.insert(table).values({ name, createdAt: now, updatedAt: now }).returning({ id: table.id });
	cache.set(key, created.id);
	return created.id;
}

/**
 * Create a book already linked to an ABS item: split authors (first is primary), first
 * narrator, audio format, owned by the sync owner, tagged Audiobook Shelf + Auto-Added.
 */
export async function createBookFromItem(ownerId: number, item: AbsLibraryItem | AbsExpandedItem, cache: CreateCache = {}): Promise<CreatedBook> {
	const mi = toMatchItem(item);
	const title = cleanTitle(mi.title);
	if (!title) throw new Error('Audiobookshelf item has no title');

	cache.authorIds ??= await keyedIds(authors);
	cache.narratorIds ??= await keyedIds(narrators);
	cache.formatId ??= await ensureAudioFormat();
	if (cache.statusId === undefined) cache.statusId = await getUnreadStatusId();
	cache.tagIds ??= [await ensureAbsTag(), await ensureAutoAddedTag()];

	const authorIds: number[] = [];
	for (const name of mi.authors) {
		const id = await ensurePerson(authors, cache.authorIds, name);
		if (!authorIds.includes(id)) authorIds.push(id);
	}
	const [narratorName] = itemNarrators(item);
	const narratorId = narratorName ? await ensurePerson(narrators, cache.narratorIds, narratorName) : null;
	const isbn13 = normalizeIsbn(mi.isbn);

	const book = await createBook({
		title,
		authors: authorIds.map((id, i) => ({ id, isPrimary: i === 0 })),
		narratorId,
		formatId: cache.formatId,
		statusId: cache.statusId,
		ownerId,
		libraryType: 'personal',
		asin: normalizeAsin(mi.asin),
		isbn13,
		absItemId: item.id,
		tagIds: cache.tagIds
	});
	log.info('Created book from Audiobookshelf item', { bookId: book.id, absItemId: item.id, title });
	return { id: book.id, title, author: mi.authors[0] ?? null };
}

async function notifyCreated(ctx: RunContext): Promise<void> {
	const created = ctx.createdBooks;
	if (created.length === 0) return;
	const origin = env.ORIGIN?.replace(/\/+$/, '') || undefined;
	const report = (err: unknown) => log.warn('Book added notification failed', { error: err instanceof Error ? err.message : String(err) });

	if (created.length <= NOTIFY_PER_BOOK_MAX) {
		for (const b of created) await notifyBookAdded(ctx.owner.id, { id: b.id, title: b.title, author: b.author ?? undefined }, origin).catch(report);
		return;
	}
	await sendNotification(ctx.owner.id, 'book_added', {
		title: '🎧 Audiobooks Added',
		message: `${created.length} audiobooks were added from Audiobookshelf.`,
		priority: 2,
		tags: ['headphones', 'heavy_plus_sign'],
		click: origin ? `${origin}/admin/abs` : undefined
	}).catch(report);
}

// ============================================
// Series / people pushback (blanks only)
// ============================================

interface BookPushData {
	series: { name: string; sequence: string | null } | null;
	authors: string[];
	narrator: string | null;
}

async function loadPushData(bookIds: number[]): Promise<Map<number, BookPushData>> {
	const out = new Map<number, BookPushData>();
	if (bookIds.length === 0) return out;

	// bookseries.bookNum is REAL (2.5 survives); the legacy books.bookNum is INTEGER and never read
	const [seriesRows, narratorRows, authorNames] = await Promise.all([
		db.select({
			bookId: bookSeries.bookId,
			title: series.title,
			bookNum: bookSeries.bookNum,
			bookNumEnd: bookSeries.bookNumEnd
		})
			.from(bookSeries)
			.innerJoin(series, eq(bookSeries.seriesId, series.id))
			.where(inArray(bookSeries.bookId, bookIds))
			.orderBy(desc(bookSeries.isPrimary), asc(bookSeries.displayOrder), asc(bookSeries.id)),
		db.select({ bookId: books.id, name: narrators.name })
			.from(books)
			.innerJoin(narrators, eq(books.narratorId, narrators.id))
			.where(inArray(books.id, bookIds)),
		loadAuthorNames(bookIds)
	]);

	for (const id of bookIds) out.set(id, { series: null, authors: authorNames.get(id) ?? [], narrator: null });
	for (const r of seriesRows) {
		const entry = out.get(r.bookId);
		if (entry && !entry.series && r.title?.trim()) {
			entry.series = { name: r.title.trim(), sequence: seriesSequence(r.bookNum, r.bookNumEnd) };
		}
	}
	for (const r of narratorRows) {
		const entry = out.get(r.bookId);
		if (entry && r.name?.trim()) entry.narrator = r.name.trim();
	}
	return out;
}

/**
 * Full-scan, self-healing: every linked in-scope book whose item looks blank is re-read
 * (expanded) right before the PATCH, and only fields still blank on that fresh copy are sent.
 */
async function pushbackPass(ctx: RunContext, scope: Scope, scanned: Map<string, ScannedItem>): Promise<void> {
	const people = await getSettingAs<boolean>('integration.abs_sync_pushback_people', 'boolean');
	const linked = [...scope.byId.values()].filter((b) => b.id > 0 && b.absItemId && scanned.has(b.absItemId));
	const pushData = await loadPushData(linked.map((b) => b.id));
	const done = new Set<string>();

	for (const book of linked) {
		const itemId = book.absItemId as string;
		if (done.has(itemId)) continue;
		const scan = scanned.get(itemId) as ScannedItem;
		const data = pushData.get(book.id);
		if (!data) continue;

		const wantSeries = !!data.series && scan.hasSeries !== true;
		const wantAuthors = people && data.authors.length > 0 && scan.hasAuthors !== true;
		const wantNarrator = people && !!data.narrator && scan.hasNarrators !== true;
		if (!wantSeries && !wantAuthors && !wantNarrator) continue;
		done.add(itemId);

		try {
			const fresh = await getAbsItemOrNull(ctx.config, itemId);
			if (!fresh) continue; // gone since the scan; the stale pass decides
			const meta = fresh.media?.metadata ?? {};
			const patch: Record<string, unknown> = {};
			const fields: string[] = [];

			if (wantSeries && !(meta.series?.length) && !meta.seriesName?.trim()) {
				patch.series = [{ name: data.series!.name, sequence: data.series!.sequence }];
				fields.push(data.series!.sequence ? `series ${data.series!.name} #${data.series!.sequence}` : `series ${data.series!.name}`);
			}
			if (wantAuthors && !(meta.authors?.length) && !meta.authorName?.trim()) {
				patch.authors = data.authors.map((name) => ({ name }));
				fields.push('authors');
			}
			if (wantNarrator && !(meta.narrators?.length) && !meta.narratorName?.trim()) {
				patch.narrators = [data.narrator];
				fields.push('narrator');
			}
			if (fields.length === 0) continue;

			if (!ctx.preview) await absPatchItemMedia(ctx.config, itemId, patch);
			ctx.pushed++;
			ctx.detail({ pass: 'pushback', action: 'pushed', absItemId: itemId, bookId: book.id, title: book.title, fields });
		} catch (err) {
			ctx.fail({ pass: 'pushback', absItemId: itemId, bookId: book.id, title: book.title }, err);
		}
	}
}

// ============================================
// Stale links (only after a complete scan; only a 404 is stale)
// ============================================

async function stalePass(ctx: RunContext, scanned: Map<string, ScannedItem>): Promise<void> {
	const linked = await db.select({ id: books.id, title: books.title, absItemId: books.absItemId, absLinkStaleAt: books.absLinkStaleAt })
		.from(books).where(isNotNull(books.absItemId));
	const now = new Date().toISOString();
	const verdicts = new Map<string, boolean>(); // itemId -> found

	for (const book of linked) {
		const itemId = book.absItemId as string;
		let found = scanned.has(itemId) ? true : verdicts.get(itemId);
		if (found === undefined) {
			try {
				// Not in the scanned library: may live in another library, so ask for it directly
				found = (await getAbsItemOrNull(ctx.config, itemId)) !== null;
				verdicts.set(itemId, found);
			} catch (err) {
				ctx.fail({ pass: 'stale', absItemId: itemId, bookId: book.id, title: book.title }, err);
				verdicts.set(itemId, true); // unknown: never flag on a non-404
				continue;
			}
		}

		if (!found && !book.absLinkStaleAt) {
			if (!ctx.preview) await db.update(books).set({ absLinkStaleAt: now }).where(eq(books.id, book.id));
			ctx.staleFound++;
			ctx.detail({ pass: 'stale', action: 'stale', absItemId: itemId, bookId: book.id, title: book.title });
		} else if (found && book.absLinkStaleAt) {
			if (!ctx.preview) await db.update(books).set({ absLinkStaleAt: null }).where(eq(books.id, book.id));
			ctx.staleCleared++;
			ctx.detail({ pass: 'stale', action: 'cleared', absItemId: itemId, bookId: book.id, title: book.title });
		}
	}
}

// ============================================
// Status sync (ABS → BookShelf only, by status key)
// ============================================

// ABS timestamps are epoch ms; book reading dates are YYYY-MM-DD in the app timezone
function toDateOnly(epochMs: number | null | undefined): string {
	return epochMs ? dateInAppTz(epochMs) : todayInAppTz();
}

async function statusPass(ctx: RunContext, scope: Scope): Promise<void> {
	const [done, current] = await Promise.all([getStatusByKey('READ'), getStatusByKey('CURRENT')]);
	if (!done && !current) {
		log.warn('No READ or CURRENT status found; status sync skipped');
		return;
	}

	let progressByItem: Map<string, AbsMediaProgress>;
	try {
		progressByItem = await fetchProgressByItem(ctx.config);
	} catch (err) {
		ctx.fail({ pass: 'status' }, err);
		return;
	}
	if (progressByItem.size === 0) return;

	const linkedIds = [...scope.byId.values()].filter((b) => b.id > 0 && b.absItemId).map((b) => b.id);
	if (linkedIds.length === 0) return;

	// Re-read link + status: the match pass may have linked books in this run
	const [rows, ownerRows] = await Promise.all([
		db.select({ id: books.id, title: books.title, absItemId: books.absItemId, statusId: books.statusId, absWritebackItemId: books.absWritebackItemId })
			.from(books).where(and(inArray(books.id, linkedIds), isNotNull(books.absItemId))),
		db.select({ bookId: userBooks.bookId, statusId: userBooks.statusId })
			.from(userBooks).where(and(eq(userBooks.userId, ctx.owner.id), inArray(userBooks.bookId, linkedIds)))
	]);
	const ownerStatus = new Map(ownerRows.map((r) => [r.bookId, r.statusId]));

	for (const book of rows) {
		const raw = progressByItem.get(book.absItemId as string);
		if (!raw) continue;

		// Owned books move as a whole; other books in the owner's library move only the owner's record
		const owned = scope.ownedIds.has(book.id);
		if (!owned && !ownerStatus.has(book.id)) continue;
		const statusNow = owned ? book.statusId : ownerStatus.get(book.id) ?? null;

		// Done stays Done, whatever ABS says now
		if (done && statusNow === done.id) continue;

		const progress = toAbsProgress(raw);
		let target: number | null = null;
		const stampDates: { startReadingDate?: string; completedDate?: string } = {};
		if (raw.startedAt) stampDates.startReadingDate = toDateOnly(raw.startedAt);

		if (progress.isFinished) {
			if (!done) continue;
			// Historical guard: the removed write-back finished this item itself; the user has since moved the book off Done
			if (book.absWritebackItemId === book.absItemId) continue;
			target = done.id;
			stampDates.completedDate = toDateOnly(raw.finishedAt);
		} else if (progress.progress > 0) {
			if (!current || statusNow === current.id) continue;
			target = current.id;
		}
		if (target === null) continue;

		try {
			if (!ctx.preview) {
				const { changed } = await applyStatusChange([book.id], target, {
					source: 'abs_sync',
					userId: ctx.owner.id,
					stampDates,
					userBooksOnly: !owned
				});
				if (changed.length === 0) continue;
			}
			ctx.statusFlips++;
			ctx.detail({
				pass: 'status',
				action: 'status',
				absItemId: book.absItemId as string,
				bookId: book.id,
				title: book.title,
				reason: target === done?.id ? 'READ' : 'CURRENT'
			});
		} catch (err) {
			ctx.fail({ pass: 'status', absItemId: book.absItemId as string, bookId: book.id, title: book.title }, err);
		}
	}
}

// ============================================
// Attention rows written by runs
// ============================================

interface AttentionInput {
	absItemId: string;
	kind: 'ambiguous_match' | 'duplicate_link';
	itemTitle: string | null;
	itemAuthor?: string | null;
	itemNarrator?: string | null;
	itemAsin?: string | null;
	itemIsbn?: string | null;
	tier: string | null;
	candidates: MatchCandidate[];
}

/** Insert an open row for the item, or refresh the open one (one open row per item). */
export async function upsertOpenAttention(runId: number | null, input: AttentionInput): Promise<void> {
	const now = new Date().toISOString();
	const fields = {
		kind: input.kind,
		itemTitle: input.itemTitle,
		itemAuthor: input.itemAuthor ?? null,
		itemNarrator: input.itemNarrator ?? null,
		itemAsin: input.itemAsin ?? null,
		itemIsbn: input.itemIsbn ?? null,
		tier: input.tier,
		candidates: JSON.stringify(input.candidates),
		lastSeenRunId: runId,
		updatedAt: now
	};
	const [open] = await db.select({ id: absSyncAttention.id }).from(absSyncAttention)
		.where(and(eq(absSyncAttention.absItemId, input.absItemId), eq(absSyncAttention.status, 'open'))).limit(1);
	if (open) {
		await db.update(absSyncAttention).set(fields).where(eq(absSyncAttention.id, open.id));
		return;
	}
	await db.insert(absSyncAttention).values({ ...fields, absItemId: input.absItemId, status: 'open', firstSeenRunId: runId, createdAt: now });
}

export async function resolveAttention(
	id: number,
	resolution: 'linked' | 'created' | 'ignored' | 'kept' | 'auto',
	bookId: number | null,
	userId: number | null
): Promise<void> {
	const now = new Date().toISOString();
	await db.update(absSyncAttention).set({
		status: resolution === 'ignored' ? 'ignored' : 'resolved',
		resolution,
		resolvedBookId: bookId,
		resolvedBy: userId,
		resolvedAt: now,
		updatedAt: now
	}).where(eq(absSyncAttention.id, id));
}

// ============================================
// Failure alert + pruning
// ============================================

/** Consecutive failed scheduled apply runs, newest first. Manual and preview runs never count; abandoned ones are skipped. */
export async function getScheduledFailureStreak(): Promise<number> {
	const rows = await db.select({ status: absSyncRuns.status })
		.from(absSyncRuns)
		.where(and(eq(absSyncRuns.triggerType, 'scheduled'), eq(absSyncRuns.mode, 'apply'), ne(absSyncRuns.status, 'running'), ne(absSyncRuns.status, 'abandoned')))
		.orderBy(desc(absSyncRuns.startedAt), desc(absSyncRuns.id))
		.limit(64);
	let streak = 0;
	for (const r of rows) {
		if (r.status !== 'failed') break;
		streak++;
	}
	return streak;
}

async function maybeAlert(runId: number, error: string | null): Promise<void> {
	if ((await getScheduledFailureStreak()) !== ALERT_AFTER_FAILURES) return;
	const res = await sendSystemNotification({
		title: '⚠️ Audiobookshelf sync failing',
		message: `The last ${ALERT_AFTER_FAILURES} scheduled Audiobookshelf syncs failed. Latest error: ${error ?? 'unknown'}`,
		priority: 4,
		tags: ['warning', 'headphones']
	});
	await db.update(absSyncRuns).set({ alertedAt: new Date().toISOString() }).where(eq(absSyncRuns.id, runId));
	log.warn('Audiobookshelf sync failure alert', { runId, sent: res.success, error: res.error });
}

/** Keep the newest 500 runs and nothing older than 90 days. Attention FKs are ON DELETE SET NULL. */
async function pruneRuns(): Promise<void> {
	const cutoff = new Date(Date.now() - RUN_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const newest = db.select({ id: absSyncRuns.id }).from(absSyncRuns).orderBy(desc(absSyncRuns.id)).limit(RUN_KEEP_COUNT);
	const result = await db.delete(absSyncRuns).where(and(
		ne(absSyncRuns.status, 'running'),
		or(lt(absSyncRuns.startedAt, cutoff), notInArray(absSyncRuns.id, newest))
	));
	if (result.changes > 0) log.debug('Pruned Audiobookshelf sync runs', { removed: result.changes });
}

// ============================================
// Schedule
// ============================================

export interface SyncSchedule {
	intervalMinutes: number;
	/** null when the interval is Off */
	nextRunAt: string | null;
	lastScheduledRunId: number | null;
	consecutiveScheduledFailures: number;
}

/**
 * Due = startedAt of the last non-preview run (any trigger, any outcome) + interval, the wait
 * doubling per extra consecutive scheduled failure (capped at 24 h). No runs yet: the carried-over
 * pre-2.23 last sync, else boot time. Overdue just means due: catch-up fires once.
 */
export async function getSchedule(): Promise<SyncSchedule> {
	const [intervalMinutes, streak, [lastApply], [lastScheduled]] = await Promise.all([
		getSyncIntervalMinutes(),
		getScheduledFailureStreak(),
		db.select({ startedAt: absSyncRuns.startedAt }).from(absSyncRuns)
			.where(eq(absSyncRuns.mode, 'apply'))
			.orderBy(desc(absSyncRuns.startedAt), desc(absSyncRuns.id)).limit(1),
		db.select({ id: absSyncRuns.id }).from(absSyncRuns)
			.where(eq(absSyncRuns.triggerType, 'scheduled'))
			.orderBy(desc(absSyncRuns.id)).limit(1)
	]);

	const base = { intervalMinutes, lastScheduledRunId: lastScheduled?.id ?? null, consecutiveScheduledFailures: streak };
	if (intervalMinutes === 0) return { ...base, nextRunAt: null };

	let anchor = lastApply ? Date.parse(lastApply.startedAt) : NaN;
	if (Number.isNaN(anchor)) anchor = Date.parse(await getSetting('integration.abs_sync_anchor_at'));
	if (Number.isNaN(anchor)) anchor = state().bootAt;

	const intervalMs = intervalMinutes * 60 * 1000;
	const waitMs = Math.min(intervalMs * 2 ** Math.max(0, streak - 1), Math.max(MAX_BACKOFF_MS, intervalMs));
	return { ...base, nextRunAt: new Date(anchor + waitMs).toISOString() };
}

export type TickOutcome = 'running' | 'not-ready' | 'off' | 'not-due' | 'started' | 'busy';

/**
 * One scheduler check. Silent when a run is in flight (no row, no 409), when sync is off or
 * not configured, or when not yet due. The clock is injectable for tests.
 */
export async function schedulerTick(now: number = Date.now()): Promise<TickOutcome> {
	try {
		if (state().activeRunId !== null) return 'running';

		const ready = await checkReadiness();
		if (!ready.ok) {
			// Log a configuration problem once, not every minute
			if (state().lastNotReadyMessage !== ready.message) {
				state().lastNotReadyMessage = ready.message;
				log.debug('Scheduled Audiobookshelf sync not ready', { reason: ready.message });
			}
			return 'not-ready';
		}
		state().lastNotReadyMessage = null;

		const schedule = await getSchedule();
		if (schedule.nextRunAt === null) return 'off';
		if (now < Date.parse(schedule.nextRunAt)) return 'not-due';

		const started = await startSync({ mode: 'apply', trigger: 'scheduled' });
		return started.ok ? 'started' : started.status === 409 ? 'busy' : 'not-ready';
	} catch (err) {
		log.error('Audiobookshelf scheduled sync check crashed', { error: err instanceof Error ? err.message : String(err) });
		return 'not-ready';
	}
}

/**
 * Start the background loop (idempotent). Recovers runs a dead process left 'running',
 * then checks every minute whether a scheduled run is due.
 */
export function startAbsSyncScheduler(): void {
	const g = globalThis as SyncGlobal;
	if (g[SCHEDULER_KEY]) return;

	state().bootAt = Date.now();
	void recoverAbandonedRuns().catch((err) =>
		log.error('Failed to recover interrupted Audiobookshelf sync runs', { error: err instanceof Error ? err.message : String(err) })
	);

	const interval = setInterval(() => void schedulerTick(), SCHEDULER_TICK_MS);
	interval.unref?.();
	g[SCHEDULER_KEY] = interval;
}

// ============================================
// Overview for the admin UI
// ============================================

export interface SyncOverview {
	enabled: boolean;
	configured: boolean;
	owner: SyncOwner | null;
	running: SyncRunView | null;
	lastRun: SyncRunView | null;
	lastApplyRun: SyncRunView | null;
	consecutiveScheduledFailures: number;
	attentionOpen: number;
	staleLinks: number;
	linkedCount: number;
	unlinkedAudioCount: number;
	schedule: SyncSchedule;
}

export async function getSyncOverview(): Promise<SyncOverview> {
	const [config, syncEnabled, owner, schedule, audioIds] = await Promise.all([
		getAbsConfig(),
		getSettingAs<boolean>('integration.abs_sync_enabled', 'boolean'),
		resolveSyncOwner(),
		getSchedule(),
		getAudioFormatIds()
	]);

	const [[running], [lastRun], [lastApplyRun], [attention], [stale], [linked], [unlinked]] = await Promise.all([
		db.select().from(absSyncRuns).where(eq(absSyncRuns.status, 'running')).limit(1),
		db.select().from(absSyncRuns).where(ne(absSyncRuns.status, 'running')).orderBy(desc(absSyncRuns.id)).limit(1),
		db.select().from(absSyncRuns).where(and(ne(absSyncRuns.status, 'running'), eq(absSyncRuns.mode, 'apply'))).orderBy(desc(absSyncRuns.id)).limit(1),
		db.select({ n: count() }).from(absSyncAttention).where(eq(absSyncAttention.status, 'open')),
		db.select({ n: count() }).from(books).where(isNotNull(books.absLinkStaleAt)),
		db.select({ n: count() }).from(books).where(isNotNull(books.absItemId)),
		audioIds.length
			? db.select({ n: count() }).from(books).where(and(inArray(books.formatId, audioIds), isNull(books.absItemId)))
			: Promise.resolve([{ n: 0 }])
	]);

	return {
		enabled: config.enabled && syncEnabled,
		configured: !!config.baseUrl && !!config.apiKey,
		owner,
		running: running ? toRunView(running, false) : null,
		lastRun: lastRun ? toRunView(lastRun, false) : null,
		lastApplyRun: lastApplyRun ? toRunView(lastApplyRun, false) : null,
		consecutiveScheduledFailures: schedule.consecutiveScheduledFailures,
		attentionOpen: attention?.n ?? 0,
		staleLinks: stale?.n ?? 0,
		linkedCount: linked?.n ?? 0,
		unlinkedAudioCount: unlinked?.n ?? 0,
		schedule
	};
}

/** Readiness for attention actions that touch the library (create / link). */
export async function getSyncReadiness(): Promise<Readiness> {
	return checkReadiness();
}
