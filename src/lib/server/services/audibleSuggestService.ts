/**
 * Audible series suggestions (2.27.0)
 *
 * A refresh run (Refresh Now, a single-series Refresh, or the in-app scheduler) takes up to
 * SERIES_PER_RUN series and, for each one in turn:
 *   1. Match   - series without an Audible ASIN: title+author search for up to 3 numbered member
 *                books; the series is the one whose returned sequence equals the member's bookNum
 *                (umbrella series like "The Cosmere" carry no number and never win; never series[0])
 *   2. List    - the series product's relationships give every child ASIN with its sequence;
 *                full product data comes from batched asins lookups
 *   3. Save    - one synchronous transaction: upsert every product; delete rows Audible no longer
 *                lists only when every batch came back whole
 * A failed or empty list never deletes a good saved list. Pages read the saved list only.
 *
 * "Owned" is per user: series members in the user's user_books or owned by them. Public,
 * shared or another user's books never hide a suggestion.
 */

import { db } from '$lib/server/db';
import {
	audibleRefreshRuns,
	audibleSeriesBooks,
	bookSeries,
	books,
	series,
	statuses,
	userBooks,
	type AudibleRefreshRun,
	type AudibleSeriesBook
} from '$lib/server/db/schema';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import {
	AudibleCatalogClient,
	BATCH_SIZE,
	CatalogBudgetExhausted,
	CatalogUnavailable,
	MAX_REQUESTS_PER_RUN,
	parseSequence,
	type AudibleProduct
} from './audibleCatalogClient';
import { cleanTitle, normalizeAsin, splitNames } from './absMatch';
import { ensureAudioFormat } from './absService';
import { createBook, primaryJunctionOrder } from './bookService';
import { findOrCreateAuthorByName } from './authorService';
import { findOrCreateNarratorByName } from './narratorService';
import { applyStatusChange, getStatusByKey } from './statusService';
import { getRecommendationStatusId } from './recommendationService';
import { downloadCoverImage } from './coverService';
import { notifyBookAdded } from './notificationService';
import { getSettingAs, AUDIBLE_SUGGEST_INTERVALS } from './settingsService';
import { createLogger } from './loggerService';
import { decodeHtmlEntities, extractYear } from './metadataProviders/types';
import { duplicateNameKey } from '$lib/server/utils/nameNormalization';
import type { AudibleSuggestion } from '$lib/types';

const log = createLogger('audible-suggest');

export const SCHEDULER_TICK_MS = 60_000;
export const SERIES_PER_RUN = 25;
const ENRICH_CANDIDATES = 3;
const NO_MATCH_RETRY_DAYS = 30;
/** Series with an active book jump the queue unless they were checked this recently */
const ACTIVE_RECHECK_MS = 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
const DETAILS_CAP = 200;
// Deliberately fewer than Audiobookshelf's 500: runs are small and carry no attention rows
const RUN_KEEP_COUNT = 200;
const RUN_KEEP_DAYS = 90;
const ABANDONED_ERROR = 'Server restarted during refresh';
const SEQ_EPSILON = 1e-6;
const EMPTY_LIST_KEPT = 'Audible listed no books for this series; the saved list was kept';

export type RefreshTrigger = 'manual' | 'scheduled';

// ============================================
// In-process state (survives dev HMR via globalThis)
// ============================================

interface RefreshState {
	activeRunId: number | null;
	activePromise: Promise<void> | null;
	bootAt: number;
	lastNotReadyMessage: string | null;
	/** One-tap adds in flight, keyed by user and normalized ASIN */
	adds: Map<string, Promise<AddedBook>>;
}

const STATE_KEY = Symbol.for('bookshelf.audibleSuggest');
const SCHEDULER_KEY = Symbol.for('bookshelf.audibleSuggestScheduler');
type SuggestGlobal = typeof globalThis & {
	[STATE_KEY]?: RefreshState;
	[SCHEDULER_KEY]?: ReturnType<typeof setInterval>;
};

function state(): RefreshState {
	const g = globalThis as SuggestGlobal;
	g[STATE_KEY] ??= { activeRunId: null, activePromise: null, bootAt: Date.now(), lastNotReadyMessage: null, adds: new Map() };
	return g[STATE_KEY];
}

/** Resolves when the in-flight run (if any) has finished. For tests and shutdown. */
export function waitForActiveRun(): Promise<void> {
	return state().activePromise ?? Promise.resolve();
}

// ============================================
// Keys and small helpers
// ============================================

/** Title key shared by matching, the owned check and the add's duplicate check; '' never matches */
export function titleKey(title: string | null | undefined): string {
	return title ? duplicateNameKey(cleanTitle(title)) : '';
}

const sameSeq = (a: number, b: number) => Math.abs(a - b) < SEQ_EPSILON;

function parseJsonList(value: string | null): string[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

export async function getIntervalMinutes(): Promise<number> {
	const minutes = await getSettingAs<number>('integration.audible_suggest_interval_minutes', 'number');
	return (AUDIBLE_SUGGEST_INTERVALS as readonly number[]).includes(minutes) ? minutes : 0;
}

type Readiness = { ok: true } | { ok: false; message: string };

async function checkReadiness(): Promise<Readiness> {
	if (!(await getSettingAs<boolean>('metadata.audible_enabled', 'boolean'))) {
		return { ok: false, message: 'Audible is turned off. Turn it on in Admin → Settings → Metadata.' };
	}
	return { ok: true };
}

// ============================================
// Suggestions for one series (database only, no network)
// ============================================

export type SeriesSuggestion = AudibleSuggestion;

export type SuggestionState = 'unchecked' | 'no_match' | 'failed' | 'ready';

export interface SeriesSuggestions {
	state: SuggestionState;
	audibleSeriesTitle: string | null;
	refreshedAt: string | null;
	/** The saved list is shown, but the last attempt to refresh it failed */
	lastRefreshFailed: boolean;
	ownedThrough: number | null;
	suggestions: SeriesSuggestion[];
	next: SeriesSuggestion | null;
	/** Unowned single numbered books below ownedThrough, minus next, in list order */
	missing: SeriesSuggestion[];
	/** missing.length */
	gaps: number;
	/** From the saved list; null when there is none */
	seriesInfo: SeriesInfo | null;
}

export interface SeriesInfo {
	bookCount: number | null;
	totalRuntimeMin: number | null;
	firstReleaseYear: number | null;
}

interface OwnedMember {
	title: string;
	asin: string | null;
	bookNum: number | null;
	bookNumEnd: number | null;
}

function toSuggestion(row: AudibleSeriesBook): SeriesSuggestion {
	const raw = row.sequenceRaw?.trim() || null;
	return {
		asin: row.asin,
		title: row.title,
		subtitle: row.subtitle,
		sequence: row.sequence,
		sequenceLabel: raw,
		isRange: parseSequence(raw).end !== null,
		authors: parseJsonList(row.authors),
		narrators: parseJsonList(row.narrators),
		runtimeMin: row.runtimeMin,
		coverUrl: row.coverUrl,
		releaseDate: row.releaseDate,
		audibleUrl: `https://www.audible.com/pd/${encodeURIComponent(row.asin)}`
	};
}

/** Sequence ASC (unnumbered last), then release date, then ASIN */
function compareRows(a: AudibleSeriesBook, b: AudibleSeriesBook): number {
	if (a.sequence !== b.sequence) {
		if (a.sequence === null) return 1;
		if (b.sequence === null) return -1;
		return a.sequence - b.sequence;
	}
	const ra = a.releaseDate ?? '￿', rb = b.releaseDate ?? '￿';
	if (ra !== rb) return ra < rb ? -1 : 1;
	return a.asin < b.asin ? -1 : a.asin > b.asin ? 1 : 0;
}

/** Series members this user owns: in their user_books, or owned by them */
async function getOwnedMembers(seriesId: number, userId: number): Promise<OwnedMember[]> {
	return db
		.select({ title: books.title, asin: books.asin, bookNum: bookSeries.bookNum, bookNumEnd: bookSeries.bookNumEnd })
		.from(bookSeries)
		.innerJoin(books, eq(books.id, bookSeries.bookId))
		.where(and(
			eq(bookSeries.seriesId, seriesId),
			or(eq(books.ownerId, userId), sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`)
		));
}

/**
 * Which saved rows the user already owns, one row per member at most. ASIN claims first, then
 * the title key, then (only between what is still unclaimed) the same book number with the same
 * range shape. Returns the indexes of claimed rows.
 */
export function claimOwnedRows(rows: AudibleSeriesBook[], members: OwnedMember[]): Set<number> {
	const claimedRows = new Set<number>();
	const claimedMembers = new Set<number>();
	const claim = (match: (row: AudibleSeriesBook, m: OwnedMember) => boolean) => {
		rows.forEach((row, ri) => {
			if (claimedRows.has(ri)) return;
			const mi = members.findIndex((m, i) => !claimedMembers.has(i) && match(row, m));
			if (mi < 0) return;
			claimedRows.add(ri);
			claimedMembers.add(mi);
		});
	};

	claim((row, m) => {
		const a = normalizeAsin(m.asin);
		return a !== null && a === row.asin;
	});
	claim((row, m) => {
		const k = titleKey(row.title);
		return k !== '' && k === titleKey(m.title);
	});
	claim((row, m) => {
		if (row.sequence === null || m.bookNum === null || !sameSeq(row.sequence, m.bookNum)) return false;
		const rowEnd = parseSequence(row.sequenceRaw).end;
		const memberEnd = m.bookNumEnd !== null && m.bookNumEnd > m.bookNum ? m.bookNumEnd : null;
		if (rowEnd === null || memberEnd === null) return rowEnd === memberEnd;
		return Math.round(rowEnd) === memberEnd;
	});
	return claimedRows;
}

type SeriesAudibleFields = {
	audibleAsin: string | null;
	audibleSeriesTitle: string | null;
	audibleStatus: string | null;
	audibleRefreshedAt: string | null;
	audibleRefreshError: string | null;
	numBooks: number | null;
};

/**
 * Badge numbers from the saved rows: the earliest release year that has already happened, and
 * the runtime of the single books (a box set would count its books twice)
 */
function seriesInfoOf(s: SeriesAudibleFields, rows: AudibleSeriesBook[]): SeriesInfo | null {
	if (rows.length === 0) return null;
	const today = new Date().toISOString().slice(0, 10);
	const thisYear = Number(today.slice(0, 4));
	let firstReleaseYear: number | null = null;
	let runtime = 0;
	for (const r of rows) {
		const year = r.releaseDate ? extractYear(r.releaseDate) : undefined;
		const released = (r.releaseDate ?? '').slice(0, 10) <= today && (year ?? 0) <= thisYear;
		if (year !== undefined && released && (firstReleaseYear === null || year < firstReleaseYear)) firstReleaseYear = year;
		if (typeof r.runtimeMin === 'number' && Number.isFinite(r.runtimeMin) && parseSequence(r.sequenceRaw).end === null) runtime += r.runtimeMin;
	}
	return { bookCount: s.numBooks ?? rows.length, totalRuntimeMin: runtime > 0 ? runtime : null, firstReleaseYear };
}

function computeSuggestions(s: SeriesAudibleFields, cached: AudibleSeriesBook[], members: OwnedMember[]): SeriesSuggestions {
	const rows = [...cached].sort(compareRows);
	const claimed = claimOwnedRows(rows, members);

	let ownedThrough: number | null = null;
	const raise = (n: number | null | undefined) => {
		if (n !== null && n !== undefined && Number.isFinite(n) && (ownedThrough === null || n > ownedThrough)) ownedThrough = n;
	};
	for (const m of members) raise(m.bookNumEnd !== null && m.bookNum !== null && m.bookNumEnd > m.bookNum ? m.bookNumEnd : m.bookNum);
	rows.forEach((row, i) => {
		if (claimed.has(i)) raise(parseSequence(row.sequenceRaw).end ?? row.sequence);
	});

	const unowned = rows.filter((_, i) => !claimed.has(i)).map(toSuggestion);
	const singles = unowned.filter((r) => !r.isRange);
	const through = ownedThrough as number | null;
	let next: SeriesSuggestion | null;
	let missing: SeriesSuggestion[] = [];
	if (through === null) {
		next = singles[0] ?? null;
	} else {
		const below = singles.filter((r) => r.sequence !== null && r.sequence < through - SEQ_EPSILON);
		next = singles.find((r) => r.sequence !== null && r.sequence > through + SEQ_EPSILON) ?? below[0] ?? null;
		missing = below.filter((r) => r !== next);
	}

	let st: SuggestionState;
	if (rows.length > 0) st = 'ready';
	else if (s.audibleStatus === 'no_match') st = 'no_match';
	else if (s.audibleStatus === 'failed' || s.audibleRefreshError) st = 'failed';
	else st = 'unchecked';

	return {
		state: st,
		audibleSeriesTitle: s.audibleSeriesTitle,
		refreshedAt: s.audibleRefreshedAt,
		lastRefreshFailed: rows.length > 0 && !!s.audibleRefreshError,
		ownedThrough: through,
		suggestions: unowned,
		next,
		missing,
		gaps: missing.length,
		seriesInfo: seriesInfoOf(s, rows)
	};
}

/** The series page's suggestions for one user; null when the series doesn't exist */
export async function getSeriesSuggestions(seriesId: number, userId: number): Promise<SeriesSuggestions | null> {
	const [s] = await db
		.select({
			audibleAsin: series.audibleAsin,
			audibleSeriesTitle: series.audibleSeriesTitle,
			audibleStatus: series.audibleStatus,
			audibleRefreshedAt: series.audibleRefreshedAt,
			audibleRefreshError: series.audibleRefreshError,
			numBooks: series.numBooks
		})
		.from(series)
		.where(eq(series.id, seriesId))
		.limit(1);
	if (!s) return null;

	const [cached, members] = await Promise.all([
		db.select().from(audibleSeriesBooks).where(eq(audibleSeriesBooks.seriesId, seriesId)),
		getOwnedMembers(seriesId, userId)
	]);
	return computeSuggestions(s, cached, members);
}

// ============================================
// Next Up: one line per series the user is reading
// ============================================

export interface SeriesNextUpItem {
	seriesId: number;
	seriesTitle: string;
	audibleSeriesTitle: string | null;
	ownedThrough: number | null;
	next: SeriesSuggestion;
	missing: SeriesSuggestion[];
	gaps: number;
}

export interface SeriesNextUp {
	items: SeriesNextUpItem[];
	/** Series with a saved list and nothing left to add */
	caughtUp: number;
	/** Series without a saved list yet */
	unchecked: number;
}

/**
 * Series with a member book in the user's library whose status (books.statusId, as the
 * dashboard reads it) is Currently Reading, Next or On Hold. Sorted by series title.
 */
export async function getSeriesNextUp(userId: number): Promise<SeriesNextUp> {
	const keys = await Promise.all(['CURRENT', 'NEXT', 'ON_HOLD'].map((k) => getStatusByKey(k)));
	const statusIds = keys.flatMap((s) => (s ? [s.id] : []));
	const result: SeriesNextUp = { items: [], caughtUp: 0, unchecked: 0 };
	if (statusIds.length === 0) return result;

	const active = await db
		.selectDistinct({ id: series.id, title: series.title })
		.from(series)
		.innerJoin(bookSeries, eq(bookSeries.seriesId, series.id))
		.innerJoin(books, eq(books.id, bookSeries.bookId))
		.innerJoin(userBooks, and(eq(userBooks.bookId, books.id), eq(userBooks.userId, userId)))
		.where(inArray(books.statusId, statusIds))
		.orderBy(sql`${series.title} COLLATE NOCASE`, asc(series.id));

	for (const s of active) {
		const sug = await getSeriesSuggestions(s.id, userId);
		if (!sug || sug.state !== 'ready') {
			result.unchecked++;
			continue;
		}
		if (!sug.next) {
			result.caughtUp++;
			continue;
		}
		result.items.push({
			seriesId: s.id,
			seriesTitle: s.title,
			audibleSeriesTitle: sug.audibleSeriesTitle,
			ownedThrough: sug.ownedThrough,
			next: sug.next,
			missing: sug.missing,
			gaps: sug.gaps
		});
	}
	return result;
}

// ============================================
// One-tap add
// ============================================

export interface AddedBook {
	id: number;
	title: string;
}

export type AddSuggestionResult =
	| { ok: true; created: true; book: AddedBook; statusApplied: boolean }
	| { ok: true; created: false; book: AddedBook }
	| { ok: false; status: 404; message: string };

/** The user's own copy: any of their books by ASIN, else a series member of theirs by title key */
async function findOwnCopy(userId: number, seriesId: number, row: AudibleSeriesBook): Promise<AddedBook | null> {
	const mine = or(eq(books.ownerId, userId), sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`);
	const [byAsin] = await db
		.select({ id: books.id, title: books.title })
		.from(books)
		.where(and(mine, sql`UPPER(TRIM(${books.asin})) = ${row.asin}`))
		.orderBy(asc(books.id))
		.limit(1);
	if (byAsin) return byAsin;

	const key = titleKey(row.title);
	if (!key) return null;
	const members = await db
		.select({ id: books.id, title: books.title })
		.from(books)
		.innerJoin(bookSeries, eq(bookSeries.bookId, books.id))
		.where(and(eq(bookSeries.seriesId, seriesId), mine))
		.orderBy(asc(books.id));
	return members.find((b) => titleKey(b.title) === key) ?? null;
}

async function createFromRow(userId: number, seriesId: number, row: AudibleSeriesBook): Promise<{ book: AddedBook; statusApplied: boolean; author?: string }> {
	const authorNames: string[] = [];
	const seen = new Set<string>();
	for (const name of parseJsonList(row.authors).flatMap((n) => splitNames(n))) {
		const key = duplicateNameKey(name);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		authorNames.push(name);
	}
	const authorIds: number[] = [];
	for (const name of authorNames) {
		const id = await findOrCreateAuthorByName(name);
		if (id !== null && !authorIds.includes(id)) authorIds.push(id);
	}

	const [firstNarrator] = parseJsonList(row.narrators);
	const narratorId = firstNarrator ? await findOrCreateNarratorByName(firstNarrator) : null;
	const formatId = await ensureAudioFormat();
	const coverImageUrl = row.coverUrl ? await downloadCoverImage(row.coverUrl) : null;
	const seq = parseSequence(row.sequenceRaw);

	const book = await createBook({
		title: row.title,
		asin: row.asin,
		releaseDate: row.releaseDate,
		publishYear: extractYear(row.releaseDate ?? undefined) ?? null,
		pageCount: row.runtimeMin, // runtime in minutes, the Audible metadata convention
		coverImageUrl,
		originalCoverUrl: row.coverUrl,
		formatId,
		narratorId,
		authors: authorIds.map((id, i) => ({ id, role: 'Author', isPrimary: i === 0 })),
		series: [{ id: seriesId, bookNum: seq.value ?? undefined, bookNumEnd: seq.end !== null ? Math.round(seq.end) : undefined }],
		ownerId: userId,
		libraryType: 'personal',
		statusId: null
	});

	// Wishlist when the instance has it, else Next (the recommendation add's rule)
	const statusId = await getRecommendationStatusId();
	if (statusId !== null) {
		await applyStatusChange([book.id], statusId, { source: 'series_suggestion', userId });
	}
	return { book: { id: book.id, title: book.title }, statusApplied: statusId !== null, author: authorNames[0] };
}

/**
 * Add a saved suggestion to the user's library. Only server data is used. The user's own copy
 * (by ASIN, then by title among their series members) is returned instead of a second book.
 * Concurrent taps by the same user for the same ASIN share one create: the first gets
 * created:true, the rest created:false with the same book. There is no unique index on
 * books.asin, so this guard is the only protection against a double tap.
 */
export async function addSuggestion(userId: number, seriesId: number, asinInput: string): Promise<AddSuggestionResult> {
	const asin = normalizeAsin(asinInput);
	if (!asin) return { ok: false, status: 404, message: 'This book is not in the saved Audible list for this series' };
	const [row] = await db.select().from(audibleSeriesBooks)
		.where(and(eq(audibleSeriesBooks.seriesId, seriesId), eq(audibleSeriesBooks.asin, asin)))
		.limit(1);
	if (!row) return { ok: false, status: 404, message: 'This book is not in the saved Audible list for this series' };

	const adds = state().adds;
	const key = `${userId}:${asin}`;
	const inFlight = adds.get(key);
	if (inFlight) return { ok: true, created: false, book: await inFlight };

	const work = (async (): Promise<AddSuggestionResult & { ok: true }> => {
		const existing = await findOwnCopy(userId, seriesId, row);
		if (existing) return { ok: true, created: false, book: existing };
		const made = await createFromRow(userId, seriesId, row);
		notifyBookAdded(userId, { id: made.book.id, title: made.book.title, author: made.author })
			.catch((err) => log.error('Failed to send book added notification', { error: describe(err) }));
		return { ok: true, created: true, book: made.book, statusApplied: made.statusApplied };
	})();
	const shared = work.then((r) => r.book);
	shared.catch(() => undefined); // waiters see the error; nobody waiting is not an unhandled rejection
	adds.set(key, shared);
	try {
		return await work;
	} finally {
		adds.delete(key);
	}
}

// ============================================
// Run records
// ============================================

export interface RunSeriesDetail {
	seriesId: number;
	title: string;
	outcome: 'matched' | 'refreshed' | 'refreshed_partial' | 'empty_kept' | 'no_match' | 'failed' | 'budget_exhausted';
	reason?: string;
	asin?: string;
	products?: number;
	missing?: string[];
	dedupedAbridged?: string[];
	dedupedSequence?: string[];
}

export interface RunDetails {
	budgetExhausted: boolean;
	series: RunSeriesDetail[];
}

export type RefreshRunView = Omit<AudibleRefreshRun, 'details'> & { details?: RunDetails };

function toRunView(row: AudibleRefreshRun, withDetails: boolean): RefreshRunView {
	const { details, ...rest } = row;
	if (!withDetails) return rest;
	let parsed: RunDetails = { budgetExhausted: false, series: [] };
	if (details) {
		try {
			parsed = JSON.parse(details) as RunDetails;
		} catch {
			// keep the empty shape
		}
	}
	return { ...rest, details: parsed };
}

/** Mark rows left 'running' by a dead process. One process, so at boot every running row is dead. */
export async function recoverAbandonedRuns(): Promise<number> {
	const now = new Date().toISOString();
	const result = await db.update(audibleRefreshRuns)
		.set({ status: 'abandoned', error: ABANDONED_ERROR, finishedAt: now })
		.where(eq(audibleRefreshRuns.status, 'running'));
	if (result.changes > 0) log.warn('Marked interrupted Audible refresh runs abandoned', { runs: result.changes });
	return result.changes;
}

export async function getRun(id: number): Promise<RefreshRunView | null> {
	const [row] = await db.select().from(audibleRefreshRuns).where(eq(audibleRefreshRuns.id, id)).limit(1);
	return row ? toRunView(row, true) : null;
}

async function getRunningRun(): Promise<AudibleRefreshRun | null> {
	const [row] = await db.select().from(audibleRefreshRuns).where(eq(audibleRefreshRuns.status, 'running')).limit(1);
	return row ?? null;
}

// ============================================
// Starting a run
// ============================================

export type StartRefreshResult =
	| { ok: true; run: RefreshRunView }
	| { ok: false; status: 404 | 409 | 503; message: string; details?: { runId: number; startedAt: string; trigger: string } };

// drizzle wraps driver errors ("Failed to run the query ..."); the SQLite reason is on the cause
function isUniqueViolation(err: unknown): boolean {
	for (let e: unknown = err; e instanceof Error; e = (e as Error & { cause?: unknown }).cause) {
		if ((e as Error & { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint/i.test(e.message)) return true;
	}
	return false;
}

function busyResult(row: AudibleRefreshRun | null): StartRefreshResult {
	return {
		ok: false,
		status: 409,
		message: 'An Audible series refresh is already running',
		details: row ? { runId: row.id, startedAt: row.startedAt, trigger: row.triggerType } : undefined
	};
}

/**
 * Start a run in the background. Never throws for Audible problems: those end up in the run row.
 * 503 (no row written) when Audible is off; 409 when a run is in flight; 404 for an unknown series.
 * A seriesId run refreshes that series only, whatever its state.
 */
export async function startRefresh(opts: { trigger: RefreshTrigger; userId?: number | null; seriesId?: number | null }): Promise<StartRefreshResult> {
	const ready = await checkReadiness();
	if (!ready.ok) return { ok: false, status: 503, message: ready.message };

	const scopeSeriesId = opts.seriesId ?? null;
	if (scopeSeriesId !== null) {
		const [s] = await db.select({ id: series.id }).from(series).where(eq(series.id, scopeSeriesId)).limit(1);
		if (!s) return { ok: false, status: 404, message: 'Series not found' };
	}

	const st = state();
	if (st.activeRunId !== null) return busyResult(await getRunningRun());

	let row: AudibleRefreshRun;
	try {
		[row] = await db.insert(audibleRefreshRuns).values({
			triggerType: opts.trigger,
			status: 'running',
			triggeredBy: opts.userId ?? null,
			scopeSeriesId,
			startedAt: new Date().toISOString(),
			seriesChecked: 0,
			seriesMatched: 0,
			seriesNoMatch: 0,
			seriesFailed: 0,
			productsCached: 0,
			requests: 0
		}).returning();
	} catch (err) {
		// Unique index on status='running': another process holds the lock
		if (isUniqueViolation(err)) return busyResult(await getRunningRun());
		throw err;
	}

	st.activeRunId = row.id;
	st.activePromise = executeRun(row).finally(() => {
		st.activeRunId = null;
		st.activePromise = null;
	});

	return { ok: true, run: toRunView(row, false) };
}

// ============================================
// Run execution
// ============================================

class RunContext {
	seriesChecked = 0;
	seriesMatched = 0;
	seriesNoMatch = 0;
	seriesFailed = 0;
	productsCached = 0;
	budgetExhausted = false;
	details: RunSeriesDetail[] = [];

	constructor(readonly run: AudibleRefreshRun, readonly client: AudibleCatalogClient) {}

	detail(d: RunSeriesDetail): void {
		if (this.details.length < DETAILS_CAP) this.details.push(d);
	}

	counters() {
		return {
			seriesChecked: this.seriesChecked,
			seriesMatched: this.seriesMatched,
			seriesNoMatch: this.seriesNoMatch,
			seriesFailed: this.seriesFailed,
			productsCached: this.productsCached,
			requests: this.client.requests
		};
	}
}

interface RunSeries {
	id: number;
	title: string;
	audibleAsin: string | null;
	audibleSeriesTitle: string | null;
	audibleStatus: string | null;
}

/**
 * The series a run works on. Scoped: that one series, whatever its state. Otherwise every
 * series except a recent no_match: series behind a Currently Reading / Next / On Hold book
 * first (unless checked in the last day), then the least recently attempted, never-tried first.
 */
async function selectSeries(scopeSeriesId: number | null, now: number): Promise<RunSeries[]> {
	const cols = {
		id: series.id,
		title: series.title,
		audibleAsin: series.audibleAsin,
		audibleSeriesTitle: series.audibleSeriesTitle,
		audibleStatus: series.audibleStatus
	};
	if (scopeSeriesId !== null) {
		return db.select(cols).from(series).where(eq(series.id, scopeSeriesId)).limit(1);
	}

	const statusRows = await db.select({ id: statuses.id }).from(statuses).where(inArray(statuses.key, ['CURRENT', 'NEXT', 'ON_HOLD']));
	const activeIds = statusRows.map((r) => r.id);
	const noMatchCutoff = new Date(now - NO_MATCH_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const activeCutoff = new Date(now - ACTIVE_RECHECK_MS).toISOString();
	const lastAttempt = sql`MAX(COALESCE(${series.audibleRefreshedAt}, ''), COALESCE(${series.audibleCheckedAt}, ''))`;
	const idList = activeIds.length ? sql.join(activeIds.map((id) => sql`${id}`), sql`, `) : sql`NULL`;
	const hasActiveBook = sql`EXISTS (SELECT 1 FROM bookseries bs INNER JOIN books b ON b.id = bs.bookId
		LEFT JOIN user_books ub ON ub.bookId = b.id
		WHERE bs.seriesId = ${series.id} AND (b.statusId IN (${idList}) OR ub.statusId IN (${idList})))`;
	const priority = sql`CASE WHEN ${hasActiveBook} AND ${lastAttempt} < ${activeCutoff} THEN 0 ELSE 1 END`;

	return db
		.select(cols)
		.from(series)
		.where(or(
			isNull(series.audibleStatus),
			ne(series.audibleStatus, 'no_match'),
			isNull(series.audibleCheckedAt),
			lt(series.audibleCheckedAt, noMatchCutoff)
		))
		.orderBy(priority, lastAttempt, asc(series.id))
		.limit(SERIES_PER_RUN);
}

interface Candidate {
	title: string;
	asin: string | null;
	bookNum: number;
	author: string | null;
}

type MatchResult = { kind: 'matched'; asin: string; title: string } | { kind: 'no_match'; reason: string };

/**
 * Find the series' Audible ASIN from up to 3 numbered member books (any user's: this is
 * catalog data, not ownership). A product counts when its title key or ASIN equals the
 * member's; its series entry counts only when the entry's sequence equals the member's bookNum.
 * One distinct series wins; several are narrowed by series title; still several = next candidate.
 */
async function matchSeries(client: AudibleCatalogClient, s: RunSeries): Promise<MatchResult> {
	const primaryAuthor = sql<string | null>`(SELECT a.name FROM bookauthors ba INNER JOIN authors a ON a.id = ba.authorId
		WHERE ba.bookId = ${books.id} ORDER BY ${primaryJunctionOrder('ba')} LIMIT 1)`;
	const candidates: Candidate[] = (await db
		.select({ title: books.title, asin: books.asin, bookNum: bookSeries.bookNum, author: primaryAuthor })
		.from(bookSeries)
		.innerJoin(books, eq(books.id, bookSeries.bookId))
		.where(and(eq(bookSeries.seriesId, s.id), isNotNull(bookSeries.bookNum)))
		.orderBy(asc(bookSeries.bookNum), asc(books.id))
		.limit(ENRICH_CANDIDATES)) as Candidate[];
	if (candidates.length === 0) return { kind: 'no_match', reason: 'no numbered books in this series' };

	const seriesKey = duplicateNameKey(s.title);
	for (const c of candidates) {
		const products = await client.searchTitleAuthor(cleanTitle(c.title), c.author ?? '');
		const memberKey = titleKey(c.title);
		const memberAsin = normalizeAsin(c.asin);
		const hits = new Map<string, string>(); // series ASIN -> series title
		for (const p of products) {
			const sameBook = (memberKey !== '' && titleKey(p.title) === memberKey) || (memberAsin !== null && normalizeAsin(p.asin) === memberAsin);
			if (!sameBook) continue;
			for (const entry of p.series ?? []) {
				const entryAsin = normalizeAsin(entry.asin);
				const seq = parseSequence(entry.sequence).value;
				if (!entryAsin || seq === null || !sameSeq(seq, c.bookNum)) continue;
				if (!hits.has(entryAsin)) hits.set(entryAsin, entry.title);
			}
		}
		if (hits.size === 1) {
			const [[asin, title]] = [...hits];
			return { kind: 'matched', asin, title };
		}
		if (hits.size > 1) {
			const named = [...hits].filter(([, title]) => duplicateNameKey(title ?? '') === seriesKey);
			if (named.length === 1) return { kind: 'matched', asin: named[0][0], title: named[0][1] };
		}
	}
	return { kind: 'no_match', reason: 'no member book matched an Audible series by number' };
}

type CacheRow = Omit<AudibleSeriesBook, 'id'>;

function productToRow(seriesId: number, p: AudibleProduct, sequenceRaw: string | null, now: string): CacheRow {
	const raw = sequenceRaw?.trim() || null;
	const names = (list: { name: string }[] | undefined) => JSON.stringify((list ?? []).map((x) => x.name).filter(Boolean));
	return {
		seriesId,
		asin: normalizeAsin(p.asin)!,
		sequence: parseSequence(raw).value,
		sequenceRaw: raw,
		title: decodeHtmlEntities(p.title) || p.title,
		subtitle: p.subtitle ? decodeHtmlEntities(p.subtitle) || null : null,
		authors: names(p.authors),
		narrators: names(p.narrators),
		runtimeMin: typeof p.runtime_length_min === 'number' ? p.runtime_length_min : null,
		coverUrl: p.product_images?.['1024'] || p.product_images?.['500'] || null,
		releaseDate: p.release_date ?? null,
		fetchedAt: now
	};
}

/** Audible's "not released yet" date (2200-01-01 and the like) */
const isPlaceholderDate = (d: string | null) => !!d && (extractYear(d) ?? 0) >= 2200;
const hasRealData = (r: CacheRow) => !!r.runtimeMin && r.runtimeMin > 0 && !isPlaceholderDate(r.releaseDate);
const isAltEdition = (r: CacheRow) => /dramatized|abridged/i.test(r.title);

/**
 * Which of two listings with the same number stays: real data over a placeholder stub, then
 * not Dramatized/Abridged, then the longest, then the earliest real release, then the lowest ASIN
 */
function preferListing(a: CacheRow, b: CacheRow): number {
	if (hasRealData(a) !== hasRealData(b)) return hasRealData(a) ? -1 : 1;
	if (isAltEdition(a) !== isAltEdition(b)) return isAltEdition(a) ? 1 : -1;
	const ra = a.runtimeMin ?? 0, rb = b.runtimeMin ?? 0;
	if (ra !== rb) return rb - ra;
	const da = a.releaseDate && !isPlaceholderDate(a.releaseDate) ? a.releaseDate : '￿';
	const dbb = b.releaseDate && !isPlaceholderDate(b.releaseDate) ? b.releaseDate : '￿';
	if (da !== dbb) return da < dbb ? -1 : 1;
	return a.asin < b.asin ? -1 : a.asin > b.asin ? 1 : 0;
}

/** One row per number (a range only collapses with the same range); unnumbered rows all stay */
function dedupeBySequence(rows: CacheRow[]): { rows: CacheRow[]; dropped: string[] } {
	const best = new Map<string, CacheRow>();
	for (const r of rows) {
		if (r.sequence === null) continue;
		const key = `${r.sequence}|${parseSequence(r.sequenceRaw).end ?? ''}`;
		const cur = best.get(key);
		if (!cur || preferListing(r, cur) < 0) best.set(key, r);
	}
	const kept = new Set(best.values());
	const dropped: string[] = [];
	const out = rows.filter((r) => {
		if (r.sequence === null || kept.has(r)) return true;
		dropped.push(r.asin);
		return false;
	});
	return { rows: out, dropped };
}

type ListResult =
	| { kind: 'saved'; complete: boolean; products: number; missing: string[]; dedupedAbridged: string[]; dedupedSequence: string[] }
	| { kind: 'empty'; hadCache: boolean };

/**
 * Fetch the series' book list and save it. Request errors propagate before anything is written.
 * Whole fetch: upsert all, delete rows Audible no longer lists. Short batch: upsert what came
 * back, delete nothing. Empty: nothing written here.
 */
async function refreshList(client: AudibleCatalogClient, seriesId: number, seriesAsin: string, onSaved: (tx: Tx, now: string) => void): Promise<ListResult> {
	const children = (await client.getSeriesChildren(seriesAsin)) ?? [];
	const hadCache = (await db.select({ n: count() }).from(audibleSeriesBooks).where(eq(audibleSeriesBooks.seriesId, seriesId)))[0].n > 0;
	if (children.length === 0) return { kind: 'empty', hadCache };

	const products: AudibleProduct[] = [];
	const missing: string[] = [];
	for (let i = 0; i < children.length; i += BATCH_SIZE) {
		const batch = await client.getProducts(children.slice(i, i + BATCH_SIZE).map((c) => c.asin));
		products.push(...batch.products);
		missing.push(...batch.missing);
	}

	const now = new Date().toISOString();
	const seqByAsin = new Map(children.map((c) => [c.asin, c.sequence]));
	let rows = products.map((p) => productToRow(seriesId, p, seqByAsin.get(normalizeAsin(p.asin)!) ?? null, now));

	// Abridged editions go when an unabridged one has the same number
	const formatByAsin = new Map(products.map((p) => [normalizeAsin(p.asin)!, (p.format_type ?? '').toLowerCase()]));
	const unabridgedSeqs = rows.filter((r) => r.sequence !== null && formatByAsin.get(r.asin) !== 'abridged').map((r) => r.sequence as number);
	const dedupedAbridged: string[] = [];
	rows = rows.filter((r) => {
		const drop = formatByAsin.get(r.asin) === 'abridged' && r.sequence !== null && unabridgedSeqs.some((q) => sameSeq(q, r.sequence as number));
		if (drop) dedupedAbridged.push(r.asin);
		return !drop;
	});
	// Then one listing per number: Audible lists dramatized, international and placeholder twins
	const deduped = dedupeBySequence(rows);
	rows = deduped.rows;

	if (rows.length === 0) return { kind: 'empty', hadCache };

	const complete = missing.length === 0;
	// Survivors only, so a whole fetch also clears twins saved by earlier versions
	const keep = rows.map((r) => r.asin);
	// Synchronous: better-sqlite3 transactions must not await
	db.transaction((tx) => {
		for (const r of rows) {
			const { seriesId: _s, asin: _a, ...fields } = r;
			tx.insert(audibleSeriesBooks).values(r)
				.onConflictDoUpdate({ target: [audibleSeriesBooks.seriesId, audibleSeriesBooks.asin], set: fields })
				.run();
		}
		if (complete) {
			tx.delete(audibleSeriesBooks)
				.where(and(eq(audibleSeriesBooks.seriesId, seriesId), notInArray(audibleSeriesBooks.asin, keep)))
				.run();
			// Number of Books follows Audible on a whole fetch only
			tx.update(series)
				.set({ numBooks: sql`(SELECT COUNT(*) FROM ${audibleSeriesBooks} WHERE ${audibleSeriesBooks.seriesId} = ${seriesId})` })
				.where(eq(series.id, seriesId))
				.run();
		}
		onSaved(tx, now);
	});
	return { kind: 'saved', complete, products: rows.length, missing, dedupedAbridged, dedupedSequence: deduped.dropped };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function describe(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * One series, start to finish: match (when it has no ASIN yet), then the book list. Nothing is
 * written until the series is done, so a series cut off by the budget is left exactly as it was.
 */
async function processSeries(ctx: RunContext, s: RunSeries): Promise<void> {
	const client = ctx.client;
	let asin = s.audibleAsin;
	let seriesTitle = s.audibleSeriesTitle;
	let newMatch = false;

	if (!asin) {
		let match: MatchResult;
		try {
			match = await matchSeries(client, s);
		} catch (err) {
			if (err instanceof CatalogBudgetExhausted || err instanceof CatalogUnavailable) throw err;
			const now = new Date().toISOString();
			await db.update(series).set({ audibleStatus: 'failed', audibleCheckedAt: now }).where(eq(series.id, s.id));
			ctx.seriesFailed++;
			ctx.detail({ seriesId: s.id, title: s.title, outcome: 'failed', reason: `match: ${describe(err)}` });
			return;
		}
		if (match.kind === 'no_match') {
			const now = new Date().toISOString();
			await db.update(series).set({ audibleStatus: 'no_match', audibleCheckedAt: now }).where(eq(series.id, s.id));
			ctx.seriesNoMatch++;
			ctx.detail({ seriesId: s.id, title: s.title, outcome: 'no_match', reason: match.reason });
			return;
		}
		asin = match.asin;
		seriesTitle = match.title;
		newMatch = true;
	}

	const matchFields = newMatch ? { audibleAsin: asin, audibleSeriesTitle: seriesTitle, audibleStatus: 'matched' } : {};

	let list: ListResult;
	try {
		list = await refreshList(client, s.id, asin, (tx, now) => {
			tx.update(series)
				.set({ ...matchFields, audibleStatus: 'matched', audibleCheckedAt: now, audibleRefreshedAt: now, audibleRefreshError: null })
				.where(eq(series.id, s.id))
				.run();
		});
	} catch (err) {
		if (err instanceof CatalogBudgetExhausted || err instanceof CatalogUnavailable) throw err;
		// The saved list stays; the series stays in the queue
		const now = new Date().toISOString();
		await db.update(series).set({ ...matchFields, audibleCheckedAt: now, audibleRefreshError: describe(err) }).where(eq(series.id, s.id));
		ctx.seriesFailed++;
		ctx.detail({ seriesId: s.id, title: s.title, outcome: 'failed', asin, reason: `book list: ${describe(err)}` });
		return;
	}

	const now = new Date().toISOString();
	if (list.kind === 'empty') {
		if (list.hadCache) {
			await db.update(series).set({ ...matchFields, audibleCheckedAt: now, audibleRefreshError: EMPTY_LIST_KEPT }).where(eq(series.id, s.id));
			log.warn('Audible listed no books for a series with a saved list; kept it', { seriesId: s.id, asin });
			ctx.seriesFailed++;
			ctx.detail({ seriesId: s.id, title: s.title, outcome: 'empty_kept', asin, reason: 'empty_enumeration' });
		} else {
			// Never filled: no_match, ASIN kept, retried after NO_MATCH_RETRY_DAYS
			await db.update(series)
				.set({ audibleAsin: asin, audibleSeriesTitle: seriesTitle, audibleStatus: 'no_match', audibleCheckedAt: now, audibleRefreshError: null })
				.where(eq(series.id, s.id));
			ctx.seriesNoMatch++;
			ctx.detail({ seriesId: s.id, title: s.title, outcome: 'no_match', asin, reason: 'empty_enumeration' });
		}
		return;
	}

	ctx.seriesMatched++;
	ctx.productsCached += list.products;
	ctx.detail({
		seriesId: s.id,
		title: s.title,
		outcome: list.complete ? (newMatch ? 'matched' : 'refreshed') : 'refreshed_partial',
		asin,
		products: list.products,
		...(list.missing.length ? { missing: list.missing } : {}),
		...(list.dedupedAbridged.length ? { dedupedAbridged: list.dedupedAbridged } : {}),
		...(list.dedupedSequence.length ? { dedupedSequence: list.dedupedSequence } : {})
	});
	if (list.missing.length) log.warn('Audible left products out of a series lookup; kept their saved rows', { seriesId: s.id, missing: list.missing });
}

async function executeRun(run: AudibleRefreshRun): Promise<void> {
	const ctx = new RunContext(run, new AudibleCatalogClient(MAX_REQUESTS_PER_RUN));
	const started = Date.parse(run.startedAt);
	let status: 'succeeded' | 'partial' | 'failed' = 'succeeded';
	let error: string | null = null;

	try {
		const list = await selectSeries(run.scopeSeriesId, Date.now());
		for (const s of list) {
			try {
				ctx.seriesChecked++;
				await processSeries(ctx, s);
			} catch (err) {
				if (err instanceof CatalogBudgetExhausted) {
					// This series and the rest wait for the next run, untouched
					ctx.seriesChecked--;
					ctx.budgetExhausted = true;
					ctx.detail({ seriesId: s.id, title: s.title, outcome: 'budget_exhausted' });
					break;
				}
				throw err;
			}
			await db.update(audibleRefreshRuns).set(ctx.counters()).where(eq(audibleRefreshRuns.id, run.id));
		}
		status = ctx.seriesFailed > 0 || ctx.budgetExhausted ? 'partial' : 'succeeded';
	} catch (err) {
		status = 'failed';
		error = describe(err);
		log.error('Audible series refresh failed', { runId: run.id, error });
	}

	try {
		const details: RunDetails = { budgetExhausted: ctx.budgetExhausted, series: ctx.details };
		await db.update(audibleRefreshRuns).set({
			...ctx.counters(),
			status,
			error,
			finishedAt: new Date().toISOString(),
			durationMs: Date.now() - started,
			details: ctx.details.length > 0 || ctx.budgetExhausted ? JSON.stringify(details) : null
		}).where(eq(audibleRefreshRuns.id, run.id));
		log.info('Audible series refresh finished', { runId: run.id, trigger: run.triggerType, scope: run.scopeSeriesId, status, ...ctx.counters() });
		await pruneRuns();
	} catch (err) {
		log.error('Failed to record Audible refresh result', { runId: run.id, error: describe(err) });
	}
}

/** Keep the newest 200 runs and nothing older than 90 days */
async function pruneRuns(): Promise<void> {
	const cutoff = new Date(Date.now() - RUN_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const newest = db.select({ id: audibleRefreshRuns.id }).from(audibleRefreshRuns).orderBy(desc(audibleRefreshRuns.id)).limit(RUN_KEEP_COUNT);
	const result = await db.delete(audibleRefreshRuns).where(and(
		ne(audibleRefreshRuns.status, 'running'),
		or(lt(audibleRefreshRuns.startedAt, cutoff), notInArray(audibleRefreshRuns.id, newest))
	));
	if (result.changes > 0) log.debug('Pruned Audible refresh runs', { removed: result.changes });
}

// ============================================
// Schedule
// ============================================

/** Consecutive failed scheduled whole-library runs, newest first; abandoned ones are skipped */
export async function getScheduledFailureStreak(): Promise<number> {
	const rows = await db.select({ status: audibleRefreshRuns.status })
		.from(audibleRefreshRuns)
		.where(and(
			eq(audibleRefreshRuns.triggerType, 'scheduled'),
			isNull(audibleRefreshRuns.scopeSeriesId),
			ne(audibleRefreshRuns.status, 'running'),
			ne(audibleRefreshRuns.status, 'abandoned')
		))
		.orderBy(desc(audibleRefreshRuns.startedAt), desc(audibleRefreshRuns.id))
		.limit(64);
	let streak = 0;
	for (const r of rows) {
		if (r.status !== 'failed') break;
		streak++;
	}
	return streak;
}

export interface RefreshSchedule {
	intervalMinutes: number;
	/** null when the interval is Off */
	nextRunAt: string | null;
	consecutiveScheduledFailures: number;
}

/**
 * Due = startedAt of the last whole-library run (any trigger, any outcome; single-series runs
 * never count) + interval, the wait doubling per extra consecutive scheduled failure (capped at
 * 24 h, or the interval when that is longer). No runs yet: boot time. Overdue fires once.
 */
export async function getSchedule(): Promise<RefreshSchedule> {
	const [intervalMinutes, streak, [last]] = await Promise.all([
		getIntervalMinutes(),
		getScheduledFailureStreak(),
		db.select({ startedAt: audibleRefreshRuns.startedAt }).from(audibleRefreshRuns)
			.where(isNull(audibleRefreshRuns.scopeSeriesId))
			.orderBy(desc(audibleRefreshRuns.startedAt), desc(audibleRefreshRuns.id)).limit(1)
	]);

	const base = { intervalMinutes, consecutiveScheduledFailures: streak };
	if (intervalMinutes === 0) return { ...base, nextRunAt: null };

	let anchor = last ? Date.parse(last.startedAt) : NaN;
	if (Number.isNaN(anchor)) anchor = state().bootAt;

	const intervalMs = intervalMinutes * 60 * 1000;
	const waitMs = Math.min(intervalMs * 2 ** Math.max(0, streak - 1), Math.max(MAX_BACKOFF_MS, intervalMs));
	return { ...base, nextRunAt: new Date(anchor + waitMs).toISOString() };
}

export type TickOutcome = 'running' | 'not-ready' | 'off' | 'not-due' | 'started' | 'busy';

/** One scheduler check. Silent when a run is in flight, Audible is off, or not yet due. The clock is injectable for tests. */
export async function schedulerTick(now: number = Date.now()): Promise<TickOutcome> {
	try {
		if (state().activeRunId !== null) return 'running';

		const ready = await checkReadiness();
		if (!ready.ok) {
			if (state().lastNotReadyMessage !== ready.message) {
				state().lastNotReadyMessage = ready.message;
				log.debug('Scheduled Audible series refresh not ready', { reason: ready.message });
			}
			return 'not-ready';
		}
		state().lastNotReadyMessage = null;

		const schedule = await getSchedule();
		if (schedule.nextRunAt === null) return 'off';
		if (now < Date.parse(schedule.nextRunAt)) return 'not-due';

		const started = await startRefresh({ trigger: 'scheduled' });
		return started.ok ? 'started' : started.status === 409 ? 'busy' : 'not-ready';
	} catch (err) {
		log.error('Audible scheduled refresh check crashed', { error: describe(err) });
		return 'not-ready';
	}
}

/** Start the background loop (idempotent): recover dead runs, then check every minute. */
export function startAudibleSuggestScheduler(): void {
	const g = globalThis as SuggestGlobal;
	if (g[SCHEDULER_KEY]) return;

	state().bootAt = Date.now();
	void recoverAbandonedRuns().catch((err) => log.error('Failed to recover interrupted Audible refresh runs', { error: describe(err) }));

	const interval = setInterval(() => void schedulerTick(), SCHEDULER_TICK_MS);
	interval.unref?.();
	g[SCHEDULER_KEY] = interval;
}

// ============================================
// Overview for the admin UI
// ============================================

export interface RefreshOverview {
	enabled: boolean;
	running: RefreshRunView | null;
	lastRun: RefreshRunView | null;
	schedule: RefreshSchedule;
	counts: { series: number; matched: number; noMatch: number; failed: number; unchecked: number; withList: number };
}

export async function getRefreshOverview(): Promise<RefreshOverview> {
	const [ready, schedule] = await Promise.all([checkReadiness(), getSchedule()]);
	const [[running], [lastRun], byStatus, [withList]] = await Promise.all([
		db.select().from(audibleRefreshRuns).where(eq(audibleRefreshRuns.status, 'running')).limit(1),
		db.select().from(audibleRefreshRuns).where(ne(audibleRefreshRuns.status, 'running')).orderBy(desc(audibleRefreshRuns.id)).limit(1),
		db.select({ status: series.audibleStatus, n: count() }).from(series).groupBy(series.audibleStatus),
		db.select({ n: sql<number>`COUNT(DISTINCT ${audibleSeriesBooks.seriesId})` }).from(audibleSeriesBooks)
	]);
	const n = (st: string | null) => byStatus.find((r) => r.status === st)?.n ?? 0;
	return {
		enabled: ready.ok,
		running: running ? toRunView(running, false) : null,
		lastRun: lastRun ? toRunView(lastRun, true) : null,
		schedule,
		counts: {
			series: byStatus.reduce((sum, r) => sum + r.n, 0),
			matched: n('matched'),
			noMatch: n('no_match'),
			failed: n('failed'),
			unchecked: n(null),
			withList: Number(withList?.n ?? 0)
		}
	};
}
