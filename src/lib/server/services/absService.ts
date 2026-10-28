/**
 * Audiobookshelf integration
 *
 * Configured entirely from Admin → Settings → Integrations:
 *   integration.abs_enabled   - master toggle
 *   integration.abs_base_url  - ABS server URL
 *   integration.abs_api_key   - ABS API key (sent as Authorization: Bearer)
 *   integration.abs_sync_interval_hours - hours between automatic syncs (1-48)
 *   integration.abs_sync_status - advance book status from ABS listening progress
 *   integration.abs_sync_writeback - mark ABS items finished for Done books
 *
 * When the integration is disabled or not configured, every public function no-ops.
 *
 * Sync runs two passes, plus two optional ones:
 *   1. Link pass   - recently added, unlinked books are matched to ABS items
 *                    (ASIN-exact first, then a single exact-title hit).
 *   2. Reverse sync - every ABS library item without a BookShelf book is created
 *                    born-linked; an unlinked exact-title book is linked instead.
 *   3. Status sync - (toggle) linked books advance to Current / Done from the
 *                    key user's ABS progress; never moved backwards.
 *   4. Write-back  - (toggle) linked Done books mark their ABS item finished, once
 *                    per link (books.absWritebackItemId ledger); never un-finishes.
 *
 * Linked books carry the "Audiobook Shelf" system tag. Links made here tag the book
 * immediately; every sync also self-heals drift (tag = absItemId IS NOT NULL).
 */

import { db } from '$lib/server/db';
import { books, authors, bookAuthors, bookTags, narrators, formats, statuses, tags } from '$lib/server/db/schema';
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { getSetting, getSettingAs, setSetting } from './settingsService';
import { createBook } from './bookService';
import { applyStatusChange, getDefaultOwnerId } from './statusService';
import { createLogger } from './loggerService';
import { dateInAppTz, startOfDayInAppTz, todayInAppTz } from '$lib/server/utils/appTime';

const log = createLogger('abs');

const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 100;
const LINK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SYNC_INTERVAL_DEFAULT_HOURS = 6;
const SYNC_INTERVAL_MIN_HOURS = 1;
const SYNC_INTERVAL_MAX_HOURS = 48;
const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;
const UNLINKED_LIST_LIMIT = 500;
const SCHEDULER_TICK_MS = 15 * 60 * 1000;
const SCHEDULER_FIRST_TICK_MS = 60 * 1000;
const ABS_TAG_NAME = 'Audiobook Shelf';
const STATUS_DONE_NAME = 'Done';
const STATUS_CURRENT_NAME = 'Current';

// ============================================
// Types
// ============================================

export interface AbsConfig {
	enabled: boolean;
	baseUrl: string;
	apiKey: string;
}

interface AbsLibrary {
	id: string;
	name: string;
	mediaType?: string;
}

interface AbsBookMetadata {
	title?: string | null;
	asin?: string | null;
	authors?: { id?: string; name: string }[];
	authorName?: string | null;
	narrators?: string[];
	narratorName?: string | null;
}

interface AbsLibraryItem {
	id: string;
	media?: { metadata?: AbsBookMetadata };
}

export interface AbsTestResult {
	ok: boolean;
	libraries?: number;
	libraryName?: string | null;
	error?: string;
}

export interface AbsSearchResult {
	id: string;
	title: string;
	authorName: string | null;
	narratorName: string | null;
	asin: string | null;
}

/** Expanded ABS library item (GET /api/items/:id?expanded=1), only the fields we read */
interface AbsExpandedItem {
	id: string;
	libraryId?: string;
	size?: number;
	media?: {
		metadata?: AbsBookMetadata & {
			seriesName?: string | null;
			series?: { name: string; sequence?: string | null }[];
			publishedYear?: string | null;
			publisher?: string | null;
			description?: string | null;
		};
		duration?: number;
		size?: number;
		chapters?: unknown[];
		audioFiles?: { format?: string; codec?: string; metadata?: { ext?: string; size?: number } }[];
	};
}

export interface AbsItemDetails {
	id: string;
	title: string;
	authorName: string | null;
	narratorName: string | null;
	seriesName: string | null;
	publishedYear: string | null;
	publisher: string | null;
	description: string | null;
	asin: string | null;
	durationSec: number | null;
	numChapters: number;
	numAudioFiles: number;
	sizeBytes: number | null;
	audioFormat: string | null;
	libraryId: string | null;
}

/** ABS media progress record (GET /api/me/progress/:id, or an entry of /api/me mediaProgress) */
interface AbsMediaProgress {
	libraryItemId: string;
	episodeId?: string | null;
	duration?: number;
	progress?: number;
	currentTime?: number;
	isFinished?: boolean;
	lastUpdate?: number;
	startedAt?: number;
	finishedAt?: number | null;
}

export interface AbsProgress {
	currentTimeSec: number;
	durationSec: number;
	/** 0-1 */
	progress: number;
	isFinished: boolean;
	/** ISO timestamp of the last ABS progress update */
	lastUpdate: string | null;
}

export interface UnlinkedAudiobook {
	id: number;
	title: string;
	author: string | null;
}

export interface AbsLinkStats {
	linkedCount: number;
	unlinkedCount: number;
	unlinked: UnlinkedAudiobook[];
}

export interface AbsSyncResult {
	ok: boolean;
	skipped?: boolean;
	error?: string;
	linked: number;
	created: number;
	errors: number;
	/** Books advanced to Current / Done by the status sync (absent in results stored before 2.12.4) */
	statusFlips?: number;
	/** ABS items marked finished from Done books (absent in results stored before 2.16.0) */
	writeBacks?: number;
	/** Done books whose linked ABS item no longer exists; not counted as errors (absent before 2.16.0) */
	writeBackMissing?: number;
	durationMs: number;
}

/** Last sync run as persisted in integration.abs_last_result. */
export interface AbsLastSyncResult extends AbsSyncResult {
	finishedAt: string;
}

export interface AbsSyncStatus {
	/** Last successful sync (drives the scheduler) */
	lastSync: string | null;
	/** Last attempted run, successful or not */
	lastResult: AbsLastSyncResult | null;
	intervalHours: number;
	/** lastSync + interval; null when there has never been a successful sync */
	nextRunAt: string | null;
	schedulerCheckMinutes: number;
	/** Linked Done books not yet written back (upper bound: items already finished on ABS need no PATCH) */
	writeBackPending: number;
}

// ============================================
// Config
// ============================================

function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '');
}

export async function getAbsConfig(): Promise<AbsConfig> {
	const [enabled, baseUrl, apiKey] = await Promise.all([
		getSettingAs<boolean>('integration.abs_enabled', 'boolean'),
		getSetting('integration.abs_base_url'),
		getSetting('integration.abs_api_key')
	]);
	return { enabled: enabled as boolean, baseUrl: normalizeBaseUrl(baseUrl), apiKey: apiKey.trim() };
}

function isUsable(config: AbsConfig): boolean {
	return config.enabled && !!config.baseUrl && !!config.apiKey;
}

/** Base URL for the book page's Listen button; null unless the integration is enabled. */
export async function getAbsLinkBaseUrl(): Promise<string | null> {
	const [enabled, baseUrl] = await Promise.all([
		getSettingAs<boolean>('integration.abs_enabled', 'boolean'),
		getSetting('integration.abs_base_url')
	]);
	return enabled ? normalizeBaseUrl(baseUrl) || null : null;
}

/** Automatic sync interval in hours, clamped to 1-48 (default 6). */
export async function getAbsSyncIntervalHours(): Promise<number> {
	const hours = await getSettingAs<number>('integration.abs_sync_interval_hours', 'number');
	if (!Number.isFinite(hours)) return SYNC_INTERVAL_DEFAULT_HOURS;
	return Math.min(SYNC_INTERVAL_MAX_HOURS, Math.max(SYNC_INTERVAL_MIN_HOURS, hours));
}

// ============================================
// REST client
// ============================================

/** Non-2xx response from ABS (network failures stay plain fetch errors) */
class AbsHttpError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
	}
}

async function absGet<T>(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>, path: string): Promise<T> {
	const res = await fetch(`${config.baseUrl}${path}`, {
		// ABS only reads the key from "Authorization: Bearer <token>" (it ignores x-api-key)
		headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!res.ok) {
		const reason = res.status === 401 || res.status === 403 ? 'API key rejected' : res.statusText;
		throw new AbsHttpError(`Audiobookshelf returned ${res.status}${reason ? ` (${reason})` : ''} for ${path.split('?')[0]}`, res.status);
	}
	return (await res.json()) as T;
}

/** PATCH a JSON body; the response body is ignored (ABS returns JSON or plain "OK" by version). */
async function absPatch(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>, path: string, body: unknown): Promise<void> {
	const res = await fetch(`${config.baseUrl}${path}`, {
		method: 'PATCH',
		headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!res.ok) {
		const reason = res.status === 401 || res.status === 403 ? 'API key rejected' : res.statusText;
		throw new AbsHttpError(`Audiobookshelf returned ${res.status}${reason ? ` (${reason})` : ''} for ${path.split('?')[0]}`, res.status);
	}
	await res.body?.cancel();
}

async function getLibraries(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>): Promise<AbsLibrary[]> {
	const data = await absGet<{ libraries?: AbsLibrary[] }>(config, '/api/libraries');
	return data.libraries ?? [];
}

function pickAudiobookLibrary(libraries: AbsLibrary[]): AbsLibrary | null {
	return libraries.find((l) => l.name.toLowerCase().includes('audiobook')) ?? libraries[0] ?? null;
}

async function searchLibrary(config: AbsConfig, libraryId: string, query: string): Promise<AbsLibraryItem[]> {
	const data = await absGet<{ book?: { libraryItem: AbsLibraryItem }[] }>(
		config,
		`/api/libraries/${encodeURIComponent(libraryId)}/search?q=${encodeURIComponent(query)}`
	);
	return (data.book ?? []).map((r) => r.libraryItem).filter((item) => !!item?.id);
}

async function getLibraryItemsPage(
	config: AbsConfig,
	libraryId: string,
	page: number
): Promise<{ results: AbsLibraryItem[]; total: number }> {
	const data = await absGet<{ results?: AbsLibraryItem[]; total?: number }>(
		config,
		`/api/libraries/${encodeURIComponent(libraryId)}/items?limit=${PAGE_SIZE}&page=${page}`
	);
	return { results: data.results ?? [], total: data.total ?? 0 };
}

function describeError(err: unknown): string {
	if (!(err instanceof Error)) return 'Connection failed';
	if (err.name === 'TimeoutError') return 'Connection timed out';
	// fetch() wraps network failures as "fetch failed" with the real reason in cause
	const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
	if (cause?.code === 'ECONNREFUSED') return 'Connection refused - check the URL and port';
	if (cause?.code === 'ENOTFOUND') return 'Host not found - check the URL';
	if (cause?.code || cause?.message) return `Connection failed: ${cause.code ?? cause.message}`;
	return err.message;
}

// ============================================
// Metadata helpers
// ============================================

function normalizeTitle(title: string | null | undefined): string {
	return (title ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function itemTitle(item: AbsLibraryItem): string {
	return item.media?.metadata?.title?.trim() ?? '';
}

// Full items carry arrays; minified items carry comma-joined names
function itemAuthors(item: AbsLibraryItem): string[] {
	const meta = item.media?.metadata;
	if (meta?.authors?.length) return meta.authors.map((a) => a.name.trim()).filter(Boolean);
	return (meta?.authorName ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function itemNarrators(item: AbsLibraryItem): string[] {
	const meta = item.media?.metadata;
	if (meta?.narrators?.length) return meta.narrators.map((n) => n.trim()).filter(Boolean);
	return (meta?.narratorName ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isWithinLinkWindow(createdAt: string | null): boolean {
	if (!createdAt) return false;
	const time = new Date(createdAt).getTime();
	return !Number.isNaN(time) && Date.now() - time <= LINK_WINDOW_MS;
}

// ============================================
// Row resolution (ensure rows exist before creating books)
// ============================================

async function ensureAuthor(name: string): Promise<number> {
	const [existing] = await db.select({ id: authors.id }).from(authors)
		.where(sql`LOWER(${authors.name}) = LOWER(${name})`).limit(1);
	if (existing) return existing.id;
	const now = new Date().toISOString();
	const [created] = await db.insert(authors).values({ name, createdAt: now, updatedAt: now }).returning({ id: authors.id });
	return created.id;
}

async function ensureNarrator(name: string): Promise<number> {
	const [existing] = await db.select({ id: narrators.id }).from(narrators)
		.where(sql`LOWER(${narrators.name}) = LOWER(${name})`).limit(1);
	if (existing) return existing.id;
	const now = new Date().toISOString();
	const [created] = await db.insert(narrators).values({ name, createdAt: now, updatedAt: now }).returning({ id: narrators.id });
	return created.id;
}

// Prefers "Audio"; reuses the stock "Audiobook" format on fresh installs before creating "Audio"
async function ensureAudioFormat(): Promise<number> {
	for (const name of ['audio', 'audiobook']) {
		const [existing] = await db.select({ id: formats.id }).from(formats)
			.where(sql`LOWER(${formats.name}) = ${name}`).limit(1);
		if (existing) return existing.id;
	}
	// Fall back to any audio-like format (e.g. "Audible Audio")
	const [audioLike] = await getAudioFormatIds();
	if (audioLike !== undefined) return audioLike;
	const now = new Date().toISOString();
	const [created] = await db.insert(formats)
		.values({ name: 'Audio', icon: 'headphones', color: '#6c757d', createdAt: now, updatedAt: now })
		.returning({ id: formats.id });
	return created.id;
}

// Any format whose name contains "audio" (Audio, Audiobook, Audible Audio, ...)
async function getAudioFormatIds(): Promise<number[]> {
	const rows = await db.select({ id: formats.id }).from(formats)
		.where(sql`LOWER(${formats.name}) LIKE '%audio%'`)
		.orderBy(asc(formats.id));
	return rows.map((r) => r.id);
}

async function getUnreadStatusId(): Promise<number | null> {
	const [byName] = await db.select({ id: statuses.id }).from(statuses)
		.where(sql`LOWER(${statuses.name}) = 'unread'`).limit(1);
	if (byName) return byName.id;
	const [byKey] = await db.select({ id: statuses.id }).from(statuses)
		.where(eq(statuses.key, 'UNREAD')).limit(1);
	return byKey?.id ?? null;
}

// ============================================
// "Audiobook Shelf" tag parity
// ============================================

// Finds the tag by name (case-insensitive, reusing a user-made one) or creates it; marks it system
async function ensureAbsTag(): Promise<number> {
	const [existing] = await db.select({ id: tags.id, isSystem: tags.isSystem }).from(tags)
		.where(sql`LOWER(${tags.name}) = LOWER(${ABS_TAG_NAME})`).limit(1);
	const now = new Date().toISOString();
	if (existing) {
		if (!existing.isSystem) await db.update(tags).set({ isSystem: true, updatedAt: now }).where(eq(tags.id, existing.id));
		return existing.id;
	}
	const [created] = await db.insert(tags)
		.values({ name: ABS_TAG_NAME, color: '#f97316', icon: 'headphones', isSystem: true, createdAt: now, updatedAt: now })
		.returning({ id: tags.id });
	return created.id;
}

// booktags has no unique constraint, so check before inserting
async function addAbsTag(tagId: number, bookId: number): Promise<void> {
	const [existing] = await db.select({ id: bookTags.id }).from(bookTags)
		.where(and(eq(bookTags.tagId, tagId), eq(bookTags.bookId, bookId))).limit(1);
	if (existing) return;
	const now = new Date().toISOString();
	await db.insert(bookTags).values({ bookId, tagId, createdAt: now, updatedAt: now });
}

async function removeAbsTag(tagId: number, bookId: number): Promise<void> {
	await db.delete(bookTags).where(and(eq(bookTags.tagId, tagId), eq(bookTags.bookId, bookId)));
}

/** Set-based self-heal: every linked book gets the tag, every unlinked book loses it. */
async function healAbsTags(tagId: number): Promise<{ added: number; removed: number }> {
	const now = new Date().toISOString();
	const tagged = db.select({ bookId: bookTags.bookId }).from(bookTags).where(eq(bookTags.tagId, tagId));
	const added = await db.insert(bookTags).select(
		db.select({
			id: sql<number>`NULL`.as('id'),
			bookId: books.id,
			tagId: sql<number>`${tagId}`.as('tagId'),
			createdAt: sql<string>`${now}`.as('createdAt'),
			updatedAt: sql<string>`${now}`.as('updatedAt')
		}).from(books).where(and(isNotNull(books.absItemId), notInArray(books.id, tagged)))
	);
	const removed = await db.delete(bookTags).where(and(
		eq(bookTags.tagId, tagId),
		inArray(bookTags.bookId, db.select({ id: books.id }).from(books).where(isNull(books.absItemId)))
	));
	return { added: added.changes, removed: removed.changes };
}

/**
 * Bring one book's "Audiobook Shelf" tag in line with its absItemId (manual link/unlink).
 * No-ops when the integration is disabled or not configured.
 */
export async function applyAbsTagParity(bookId: number): Promise<void> {
	try {
		if (!isUsable(await getAbsConfig())) return;
		const [book] = await db.select({ absItemId: books.absItemId }).from(books).where(eq(books.id, bookId)).limit(1);
		if (!book) return;
		const tagId = await ensureAbsTag();
		if (book.absItemId) await addAbsTag(tagId, bookId);
		else await removeAbsTag(tagId, bookId);
	} catch (err) {
		// Non-fatal: the next sync heals the tag
		log.warn('Audiobook Shelf tag update failed', { bookId, error: err instanceof Error ? err.message : String(err) });
	}
}

// ============================================
// Public API
// ============================================

/**
 * Test a connection. Uses the stored settings unless overrides are given
 * (so the admin can test before saving). Does not require the toggle.
 */
export async function testAbsConnection(overrides: { baseUrl?: string; apiKey?: string } = {}): Promise<AbsTestResult> {
	const stored = await getAbsConfig();
	const baseUrl = normalizeBaseUrl(overrides.baseUrl ?? stored.baseUrl);
	const apiKey = (overrides.apiKey?.trim() || stored.apiKey);

	if (!baseUrl) return { ok: false, error: 'Audiobookshelf URL is not set' };
	if (!/^https?:\/\//i.test(baseUrl)) return { ok: false, error: 'Audiobookshelf URL must start with http:// or https://' };
	if (!apiKey) return { ok: false, error: 'API key is not set' };

	try {
		const libraries = await getLibraries({ baseUrl, apiKey });
		return { ok: true, libraries: libraries.length, libraryName: pickAudiobookLibrary(libraries)?.name ?? null };
	} catch (err) {
		return { ok: false, error: describeError(err) };
	}
}

/** Search the ABS audiobook library for manual linking. Throws when the integration is unusable. */
export async function searchAbsItems(query: string, limit = SEARCH_DEFAULT_LIMIT): Promise<AbsSearchResult[]> {
	const config = await getAbsConfig();
	if (!config.enabled) throw new Error('Audiobookshelf integration is disabled');
	if (!isUsable(config)) throw new Error('Audiobookshelf URL or API key is not set');

	try {
		const library = pickAudiobookLibrary(await getLibraries(config));
		if (!library) throw new Error('No libraries found on Audiobookshelf');

		const max = Math.min(SEARCH_MAX_LIMIT, Math.max(1, Math.floor(limit) || SEARCH_DEFAULT_LIMIT));
		const items = await searchLibrary(config, library.id, query);
		return items.slice(0, max).map((item) => ({
			id: item.id,
			title: itemTitle(item),
			authorName: itemAuthors(item).join(', ') || null,
			narratorName: itemNarrators(item).join(', ') || null,
			asin: item.media?.metadata?.asin?.trim() || null
		}));
	} catch (err) {
		throw new Error(describeError(err));
	}
}

/** Fetch one ABS item's details for the book page's Media panel. Throws when the integration is unusable. */
export async function getAbsItem(itemId: string): Promise<AbsItemDetails> {
	const config = await getAbsConfig();
	if (!config.enabled) throw new Error('Audiobookshelf integration is disabled');
	if (!isUsable(config)) throw new Error('Audiobookshelf URL or API key is not set');

	try {
		const item = await absGet<AbsExpandedItem>(config, `/api/items/${encodeURIComponent(itemId)}?expanded=1`);
		const media = item.media;
		const meta = media?.metadata;
		const audioFiles = media?.audioFiles ?? [];
		// ext is ".m4b"; fall back to the container format ABS probed
		const formats = [...new Set(audioFiles
			.map((f) => (f.metadata?.ext?.replace(/^\./, '') || f.format || '').toUpperCase())
			.filter(Boolean))];
		const fileBytes = audioFiles.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);
		const seriesName = meta?.seriesName?.trim()
			|| (meta?.series ?? []).map((s) => (s.sequence ? `${s.name} #${s.sequence}` : s.name)).join(', ');

		return {
			id: item.id,
			title: itemTitle(item),
			authorName: itemAuthors(item).join(', ') || null,
			narratorName: itemNarrators(item).join(', ') || null,
			seriesName: seriesName || null,
			publishedYear: meta?.publishedYear?.trim() || null,
			publisher: meta?.publisher?.trim() || null,
			// ABS descriptions are often HTML; the panel shows plain text
			description: meta?.description
				?.replace(/<[^>]*>/g, ' ')
				.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
				.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
				.replace(/\s+/g, ' ').trim() || null,
			asin: meta?.asin?.trim() || null,
			durationSec: media?.duration ?? null,
			numChapters: media?.chapters?.length ?? 0,
			numAudioFiles: audioFiles.length,
			sizeBytes: media?.size ?? item.size ?? (fileBytes || null),
			audioFormat: formats.join(', ') || null,
			libraryId: item.libraryId ?? null
		};
	} catch (err) {
		throw new Error(describeError(err));
	}
}

function toAbsProgress(p: AbsMediaProgress): AbsProgress {
	const durationSec = p.duration ?? 0;
	const currentTimeSec = p.currentTime ?? 0;
	const progress = p.progress ?? (durationSec > 0 ? currentTimeSec / durationSec : 0);
	return {
		currentTimeSec,
		durationSec,
		progress: Math.min(1, Math.max(0, progress)),
		isFinished: !!p.isFinished,
		lastUpdate: p.lastUpdate ? new Date(p.lastUpdate).toISOString() : null
	};
}

/**
 * The API key user's listening progress for one ABS item; null when ABS has none
 * (never listened). Throws when the integration is unusable or ABS fails.
 */
export async function getAbsProgress(itemId: string): Promise<AbsProgress | null> {
	const config = await getAbsConfig();
	if (!config.enabled) throw new Error('Audiobookshelf integration is disabled');
	if (!isUsable(config)) throw new Error('Audiobookshelf URL or API key is not set');

	try {
		return toAbsProgress(await absGet<AbsMediaProgress>(config, `/api/me/progress/${encodeURIComponent(itemId)}`));
	} catch (err) {
		if (err instanceof AbsHttpError && err.status === 404) return null;
		throw new Error(describeError(err));
	}
}

/** Linked/unlinked counts for audio-format books, plus the unlinked list (title order, capped). */
export async function getAbsLinkStats(): Promise<AbsLinkStats> {
	const formatIds = await getAudioFormatIds();
	if (formatIds.length === 0) return { linkedCount: 0, unlinkedCount: 0, unlinked: [] };

	const isAudio = inArray(books.formatId, formatIds);
	const [[linked], [unlinkedTotal], rows] = await Promise.all([
		db.select({ n: count() }).from(books).where(and(isAudio, isNotNull(books.absItemId))),
		db.select({ n: count() }).from(books).where(and(isAudio, isNull(books.absItemId))),
		db.select({ id: books.id, title: books.title }).from(books)
			.where(and(isAudio, isNull(books.absItemId)))
			.orderBy(asc(sql`LOWER(${books.title})`))
			.limit(UNLINKED_LIST_LIMIT)
	]);

	// Primary (lowest displayOrder) author per book
	const authorByBook = new Map<number, string>();
	if (rows.length > 0) {
		const authorRows = await db
			.select({ bookId: bookAuthors.bookId, name: authors.name })
			.from(bookAuthors)
			.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
			.where(inArray(bookAuthors.bookId, rows.map((r) => r.id)))
			.orderBy(asc(bookAuthors.displayOrder), asc(bookAuthors.id));
		for (const r of authorRows) {
			if (!authorByBook.has(r.bookId)) authorByBook.set(r.bookId, r.name);
		}
	}

	return {
		linkedCount: linked?.n ?? 0,
		unlinkedCount: unlinkedTotal?.n ?? 0,
		unlinked: rows.map((r) => ({ id: r.id, title: r.title, author: authorByBook.get(r.id) ?? null }))
	};
}

/**
 * Link pass: books without absItemId added in the last 14 days.
 * ASIN-exact match first; fallback is a single exact-title hit.
 */
async function runLinkPass(config: AbsConfig, libraryId: string, usedItemIds: Set<string>, tagId: number): Promise<{ linked: number; errors: number }> {
	let linked = 0;
	let errors = 0;
	let lastId = 0;

	for (;;) {
		const page = await db
			.select({ id: books.id, title: books.title, asin: books.asin, createdAt: books.createdAt })
			.from(books)
			.where(and(isNull(books.absItemId), gt(books.id, lastId)))
			.orderBy(books.id)
			.limit(PAGE_SIZE);
		if (page.length === 0) break;
		lastId = page[page.length - 1].id;

		for (const book of page) {
			if (!isWithinLinkWindow(book.createdAt)) continue;

			try {
				let match: AbsLibraryItem | null = null;

				const asin = book.asin?.trim();
				if (asin) {
					const hits = await searchLibrary(config, libraryId, asin);
					match = hits.find((item) => item.media?.metadata?.asin === asin) ?? null;
				}

				if (!match) {
					const wanted = normalizeTitle(book.title);
					const hits = await searchLibrary(config, libraryId, book.title);
					const exact = hits.filter((item) => normalizeTitle(itemTitle(item)) === wanted);
					if (exact.length === 1) match = exact[0];
				}

				if (match && !usedItemIds.has(match.id)) {
					await db.update(books).set({ absItemId: match.id, updatedAt: new Date().toISOString() }).where(eq(books.id, book.id));
					await addAbsTag(tagId, book.id);
					usedItemIds.add(match.id);
					linked++;
					log.info('Linked book to Audiobookshelf item', { bookId: book.id, absItemId: match.id });
				}
			} catch (err) {
				errors++;
				log.warn('Audiobookshelf link failed', { bookId: book.id, error: err instanceof Error ? err.message : String(err) });
			}
		}
	}

	return { linked, errors };
}

/**
 * Reverse sync: every ABS item with no exact-title BookShelf book is created born-linked.
 * An exact-title book without absItemId is linked instead of duplicated.
 */
async function runReverseSync(config: AbsConfig, libraryId: string, usedItemIds: Set<string>, tagId: number): Promise<{ linked: number; created: number; errors: number }> {
	let linked = 0;
	let created = 0;
	let errors = 0;

	const allBooks = await db.select({ id: books.id, title: books.title, absItemId: books.absItemId }).from(books);
	const byTitle = new Map<string, { id: number; absItemId: string | null }[]>();
	for (const b of allBooks) {
		const key = normalizeTitle(b.title);
		const list = byTitle.get(key) ?? [];
		list.push({ id: b.id, absItemId: b.absItemId });
		byTitle.set(key, list);
	}

	let ownerId: number | null | undefined;
	let formatId: number | undefined;
	let statusId: number | null | undefined;

	for (let pageNum = 0; ; pageNum++) {
		const { results, total } = await getLibraryItemsPage(config, libraryId, pageNum);
		if (results.length === 0) break;

		for (const item of results) {
			if (usedItemIds.has(item.id)) continue;
			const title = itemTitle(item);
			if (!title) continue;

			try {
				const key = normalizeTitle(title);
				const matches = byTitle.get(key);

				if (matches?.length) {
					// Already represented; link the first unlinked copy if none is linked yet
					if (matches.some((m) => m.absItemId)) continue;
					const target = matches[0];
					await db.update(books).set({ absItemId: item.id, updatedAt: new Date().toISOString() }).where(eq(books.id, target.id));
					await addAbsTag(tagId, target.id);
					target.absItemId = item.id;
					usedItemIds.add(item.id);
					linked++;
					log.info('Linked existing book to Audiobookshelf item', { bookId: target.id, absItemId: item.id });
					continue;
				}

				if (ownerId === undefined) ownerId = await getDefaultOwnerId();
				if (!ownerId) throw new Error('No admin user found for book ownership');
				if (formatId === undefined) formatId = await ensureAudioFormat();
				if (statusId === undefined) statusId = await getUnreadStatusId();

				const authorIds: number[] = [];
				for (const name of itemAuthors(item)) authorIds.push(await ensureAuthor(name));
				const [narratorName] = itemNarrators(item);
				const narratorId = narratorName ? await ensureNarrator(narratorName) : null;

				const newBook = await createBook({
					title,
					authors: authorIds.map((id) => ({ id })),
					narratorId,
					formatId,
					statusId,
					ownerId,
					absItemId: item.id,
					tagIds: [tagId]
				});
				byTitle.set(key, [{ id: newBook.id, absItemId: item.id }]);
				usedItemIds.add(item.id);
				created++;
				log.info('Created book from Audiobookshelf item', { bookId: newBook.id, absItemId: item.id, title });
			} catch (err) {
				errors++;
				log.warn('Audiobookshelf reverse sync failed for item', { absItemId: item.id, title, error: err instanceof Error ? err.message : String(err) });
			}
		}

		if ((pageNum + 1) * PAGE_SIZE >= total) break;
	}

	return { linked, created, errors };
}

async function getStatusIdByName(name: string): Promise<number | null> {
	const [row] = await db.select({ id: statuses.id }).from(statuses)
		.where(sql`LOWER(${statuses.name}) = LOWER(${name})`).limit(1);
	return row?.id ?? null;
}

// ABS timestamps are epoch ms; book reading dates are YYYY-MM-DD in the app timezone
function toDateOnly(epochMs: number | null | undefined): string {
	return epochMs ? dateInAppTz(epochMs) : todayInAppTz();
}

/** The API key user's progress for every book item, in one GET /api/me (podcast episodes skipped). */
async function fetchProgressByItem(config: AbsConfig): Promise<Map<string, AbsMediaProgress>> {
	const me = await absGet<{ mediaProgress?: AbsMediaProgress[] }>(config, '/api/me');
	const progressByItem = new Map<string, AbsMediaProgress>();
	for (const p of me.mediaProgress ?? []) {
		if (p.libraryItemId && !p.episodeId) progressByItem.set(p.libraryItemId, p);
	}
	return progressByItem;
}

/**
 * Status sync: advance linked books from the API key user's ABS progress.
 * Finished -> Done; started but unfinished -> Current. Advance-only: Done is never
 * touched, Current is never re-set, and books without ABS progress are skipped.
 * A finish that write-back sent itself (absWritebackItemId === absItemId) never pulls
 * a book the user has since moved off Done back to Done.
 */
async function runStatusSync(config: AbsConfig, progressByItem: Map<string, AbsMediaProgress>): Promise<{ flips: number; errors: number }> {
	const [doneId, currentId] = await Promise.all([
		getStatusIdByName(STATUS_DONE_NAME),
		getStatusIdByName(STATUS_CURRENT_NAME)
	]);
	if (doneId === null) log.warn(`No "${STATUS_DONE_NAME}" status found; finished audiobooks will not be marked`);
	if (currentId === null) log.warn(`No "${STATUS_CURRENT_NAME}" status found; in-progress audiobooks will not be marked`);
	if (doneId === null && currentId === null) return { flips: 0, errors: 0 };

	if (progressByItem.size === 0) return { flips: 0, errors: 0 };

	const linked = await db
		.select({
			id: books.id,
			absItemId: books.absItemId,
			statusId: books.statusId,
			absWritebackItemId: books.absWritebackItemId
		})
		.from(books)
		.where(isNotNull(books.absItemId));

	let flips = 0;
	let errors = 0;

	for (const book of linked) {
		const raw = progressByItem.get(book.absItemId as string);
		if (!raw) continue;
		// Done stays Done, whatever ABS says now
		if (doneId !== null && book.statusId === doneId) continue;

		const progress = toAbsProgress(raw);
		let targetId: number | null = null;
		const stampDates: { startReadingDate?: string; completedDate?: string } = {};
		if (raw.startedAt) stampDates.startReadingDate = toDateOnly(raw.startedAt);

		if (progress.isFinished) {
			if (doneId === null) continue;
			// We finished this item ourselves and the user has since moved the book off Done
			if (book.absWritebackItemId === book.absItemId) continue;
			targetId = doneId;
			stampDates.completedDate = toDateOnly(raw.finishedAt);
		} else if (progress.progress > 0) {
			if (currentId === null || book.statusId === currentId) continue;
			targetId = currentId;
		}
		if (targetId === null) continue;

		try {
			const { changed } = await applyStatusChange([book.id], targetId, { source: 'abs_sync', stampDates });
			if (changed.length === 0) continue;
			flips++;
			log.info('Updated book status from Audiobookshelf progress', {
				bookId: book.id,
				absItemId: book.absItemId,
				status: targetId === doneId ? STATUS_DONE_NAME : STATUS_CURRENT_NAME,
				progress: progress.progress
			});
		} catch (err) {
			errors++;
			log.warn('Audiobookshelf status update failed', { bookId: book.id, error: err instanceof Error ? err.message : String(err) });
		}
	}

	return { flips, errors };
}

// Book completedDate (YYYY-MM-DD) -> epoch ms at 12:00 UTC, so the ABS day matches in any timezone
function completedDateToEpochMs(date: string | null): number | null {
	if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
	const ms = Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Write-back: mark the ABS item finished for every linked Done book, at most once per
 * link (books.absWritebackItemId records the item written). Only isFinished, plus
 * finishedAt from completedDate, is ever sent, so the listening position is kept and
 * nothing is un-finished. Verified against ABS 2.37.2: PATCH creates a missing
 * progress record, keeps currentTime, sets progress to 1, honours a supplied
 * finishedAt, and returns 404 for unknown items. ABS clears isFinished when playback
 * resumes, which is why the ledger exists: re-listened books are not re-finished.
 */
async function runWriteBack(
	config: AbsConfig,
	progressByItem: Map<string, AbsMediaProgress>
): Promise<{ writeBacks: number; missing: number; errors: number }> {
	const result = { writeBacks: 0, missing: 0, errors: 0 };
	const doneId = await getStatusIdByName(STATUS_DONE_NAME);
	if (doneId === null) {
		log.warn(`No "${STATUS_DONE_NAME}" status found; nothing will be marked finished on Audiobookshelf`);
		return result;
	}

	// Only Done books are selected, so moving a book off Done never writes anything
	const [candidates, linkedRows] = await Promise.all([
		db.select({
			id: books.id,
			absItemId: books.absItemId,
			completedDate: books.completedDate,
			absWritebackItemId: books.absWritebackItemId
		})
			.from(books)
			.where(and(isNotNull(books.absItemId), eq(books.statusId, doneId))),
		db.select({ id: books.id, absItemId: books.absItemId }).from(books).where(isNotNull(books.absItemId))
	]);

	// One item, one book: an item linked to several books is ambiguous and left alone
	const bookIdsByItem = new Map<string, number[]>();
	for (const r of linkedRows) {
		const ids = bookIdsByItem.get(r.absItemId as string) ?? [];
		ids.push(r.id);
		bookIdsByItem.set(r.absItemId as string, ids);
	}

	const recordWriteBack = (bookId: number, absItemId: string) =>
		db.update(books).set({ absWritebackItemId: absItemId }).where(eq(books.id, bookId));
	const warnedDuplicates = new Set<string>();

	for (const book of candidates) {
		const absItemId = book.absItemId as string;
		if (book.absWritebackItemId === absItemId) continue;

		const bookIds = bookIdsByItem.get(absItemId) ?? [];
		if (bookIds.length > 1) {
			if (!warnedDuplicates.has(absItemId)) {
				warnedDuplicates.add(absItemId);
				log.warn('Audiobookshelf item is linked to several books; skipping write-back', { absItemId, bookIds });
			}
			continue;
		}

		const record = progressByItem.get(absItemId);
		try {
			if (record?.isFinished) {
				// Already finished on ABS (including books the status sync just moved to Done)
				await recordWriteBack(book.id, absItemId);
				continue;
			}

			const finishedAt = completedDateToEpochMs(book.completedDate);
			await absPatch(
				config,
				`/api/me/progress/${encodeURIComponent(absItemId)}`,
				finishedAt === null ? { isFinished: true } : { isFinished: true, finishedAt }
			);
			await recordWriteBack(book.id, absItemId);
			result.writeBacks++;
			log.info('Marked Audiobookshelf item finished', {
				bookId: book.id,
				absItemId,
				hadProgress: !!record,
				progress: record ? toAbsProgress(record).progress : 0
			});
		} catch (err) {
			if (err instanceof AbsHttpError && err.status === 404) {
				// Stale link; retried next sync, not counted as an error
				result.missing++;
				log.warn('Audiobookshelf item not found; skipping write-back', { bookId: book.id, absItemId });
				continue;
			}
			// Every remaining request would be rejected the same way
			if (err instanceof AbsHttpError && (err.status === 401 || err.status === 403)) throw err;
			result.errors++;
			log.warn('Audiobookshelf write-back failed', { bookId: book.id, absItemId, error: describeError(err) });
		}
	}

	return result;
}

/** Done + linked books the next write-back would mark finished (ledger-filtered, duplicates excluded). */
async function getAbsWriteBackPendingCount(): Promise<number> {
	const doneId = await getStatusIdByName(STATUS_DONE_NAME);
	if (doneId === null) return 0;

	const dupItems = db.select({ absItemId: books.absItemId }).from(books)
		.where(isNotNull(books.absItemId))
		.groupBy(books.absItemId)
		.having(sql`COUNT(*) > 1`);
	const [row] = await db.select({ n: count() }).from(books).where(and(
		isNotNull(books.absItemId),
		eq(books.statusId, doneId),
		or(isNull(books.absWritebackItemId), ne(books.absWritebackItemId, books.absItemId)),
		notInArray(books.absItemId, dupItems)
	));
	return row?.n ?? 0;
}

let activeSync: Promise<AbsSyncResult> | null = null;

/** Run one full sync (link, reverse, then the optional status sync and write-back). Concurrent calls share the in-flight run. */
export function runAbsSync(): Promise<AbsSyncResult> {
	if (!activeSync) {
		activeSync = doSync()
			.then(async (result) => {
				await persistLastResult(result);
				return result;
			})
			.finally(() => {
				activeSync = null;
			});
	}
	return activeSync;
}

async function persistLastResult(result: AbsSyncResult): Promise<void> {
	// Skipped runs (integration disabled / not configured) never reached ABS; keep the last real result
	if (result.skipped) return;
	try {
		const stored: AbsLastSyncResult = { ...result, finishedAt: new Date().toISOString() };
		await setSetting('integration.abs_last_result', JSON.stringify(stored));
	} catch (err) {
		log.warn('Failed to persist Audiobookshelf sync result', { error: err instanceof Error ? err.message : String(err) });
	}
}

/** Sync status for the Integrations settings tab. */
export async function getAbsSyncStatus(): Promise<AbsSyncStatus> {
	const [lastSyncRaw, lastResultRaw, intervalHours, writeBackPending] = await Promise.all([
		getSetting('integration.abs_last_sync'),
		getSetting('integration.abs_last_result'),
		getAbsSyncIntervalHours(),
		getAbsWriteBackPendingCount()
	]);

	let lastResult: AbsLastSyncResult | null = null;
	if (lastResultRaw) {
		try {
			lastResult = JSON.parse(lastResultRaw) as AbsLastSyncResult;
		} catch {
			lastResult = null;
		}
	}

	const lastTime = lastSyncRaw ? new Date(lastSyncRaw).getTime() : NaN;
	const nextRunAt = Number.isNaN(lastTime) ? null : new Date(lastTime + intervalHours * 60 * 60 * 1000).toISOString();

	return {
		lastSync: lastSyncRaw || null,
		lastResult,
		intervalHours,
		nextRunAt,
		schedulerCheckMinutes: SCHEDULER_TICK_MS / 60000,
		writeBackPending
	};
}

async function doSync(): Promise<AbsSyncResult> {
	const started = Date.now();
	const empty = { linked: 0, created: 0, errors: 0, statusFlips: 0, writeBacks: 0, writeBackMissing: 0 };
	const config = await getAbsConfig();

	if (!isUsable(config)) {
		return {
			ok: false,
			skipped: true,
			error: config.enabled ? 'Audiobookshelf URL or API key is not set' : 'Audiobookshelf integration is disabled',
			...empty,
			durationMs: 0
		};
	}

	try {
		// Heal tag drift first; it needs no network, so it runs even if ABS is unreachable
		const tagId = await ensureAbsTag();
		const healed = await healAbsTags(tagId);
		if (healed.added || healed.removed) log.info('Healed Audiobook Shelf tag drift', healed);

		const library = pickAudiobookLibrary(await getLibraries(config));
		if (!library) {
			return { ok: false, error: 'No libraries found on Audiobookshelf', ...empty, durationMs: Date.now() - started };
		}

		const linkedRows = await db.select({ absItemId: books.absItemId }).from(books)
			.where(sql`${books.absItemId} IS NOT NULL`);
		const usedItemIds = new Set(linkedRows.map((r) => r.absItemId as string));

		const linkPass = await runLinkPass(config, library.id, usedItemIds, tagId);
		const reverse = await runReverseSync(config, library.id, usedItemIds, tagId);

		const [statusOn, writebackOn] = await Promise.all([
			getSettingAs<boolean>('integration.abs_sync_status', 'boolean'),
			getSettingAs<boolean>('integration.abs_sync_writeback', 'boolean')
		]);

		// One progress snapshot shared by both passes; write-back never runs without it
		const statusSync = { flips: 0, errors: 0 };
		const writeBack = { writeBacks: 0, missing: 0, errors: 0 };
		let progressByItem: Map<string, AbsMediaProgress> | null = null;
		if (statusOn || writebackOn) {
			try {
				progressByItem = await fetchProgressByItem(config);
			} catch (err) {
				// Progress lookup failed; links and created books from this run still count
				statusSync.errors++;
				log.warn('Audiobookshelf progress lookup failed', { error: describeError(err) });
			}
		}

		// Forward first: a book it moves to Done was finished in this snapshot, so write-back skips it
		if (statusOn && progressByItem) {
			try {
				Object.assign(statusSync, await runStatusSync(config, progressByItem));
			} catch (err) {
				statusSync.errors++;
				log.warn('Audiobookshelf status sync failed', { error: describeError(err) });
			}
		}

		if (writebackOn && progressByItem) {
			try {
				Object.assign(writeBack, await runWriteBack(config, progressByItem));
			} catch (err) {
				writeBack.errors++;
				log.warn('Audiobookshelf write-back failed', { error: describeError(err) });
			}
		}

		await setSetting('integration.abs_last_sync', new Date().toISOString());

		const result: AbsSyncResult = {
			ok: true,
			linked: linkPass.linked + reverse.linked,
			created: reverse.created,
			errors: linkPass.errors + reverse.errors + statusSync.errors + writeBack.errors,
			statusFlips: statusSync.flips,
			writeBacks: writeBack.writeBacks,
			writeBackMissing: writeBack.missing,
			durationMs: Date.now() - started
		};
		log.info('Audiobookshelf sync complete', { library: library.name, ...result });
		return result;
	} catch (err) {
		const message = describeError(err);
		log.error('Audiobookshelf sync failed', { error: message });
		return { ok: false, error: message, ...empty, durationMs: Date.now() - started };
	}
}

// ============================================
// Listening history (read-only, for the stats heatmap)
// ============================================

const LISTENING_CACHE_TTL_MS = 60_000;
const MAX_LISTENING_PAGES = 30;

/** ABS playback session (GET /api/me/listening-sessions), only the fields we read */
interface AbsListeningSession {
	libraryItemId?: string;
	mediaType?: string;
	timeListening?: number;
	startedAt?: number;
	updatedAt?: number;
}

interface AbsListeningSessionsPage {
	total?: number;
	numPages?: number;
	page?: number;
	itemsPerPage?: number;
	sessions?: AbsListeningSession[];
}

export interface AbsListeningDay {
	date: string; // YYYY-MM-DD (app timezone, same rule as reading sessions)
	seconds: number;
	sessionCount: number;
	itemIds: string[];
}

export interface AbsListeningResult {
	available: boolean;
	days: AbsListeningDay[];
	error?: string;
}

// Promise is cached (not the result) so concurrent loads share one fetch; failures are cached too
const listeningCache = new Map<string, { at: number; promise: Promise<AbsListeningResult> }>();

async function fetchListeningByDay(config: AbsConfig, year: number): Promise<AbsListeningResult> {
	// App-timezone year window, so the bounds match the day keys below and the reading heatmap
	const yearStart = Date.parse(startOfDayInAppTz(`${year}-01-01`));
	const yearEnd = Date.parse(startOfDayInAppTz(`${year + 1}-01-01`));
	const dayMap = new Map<string, AbsListeningDay>();

	try {
		let truncated = false;
		for (let page = 0; ; page++) {
			if (page >= MAX_LISTENING_PAGES) {
				truncated = true;
				log.warn('ABS listening history hit the page cap', { year, pages: MAX_LISTENING_PAGES });
				break;
			}

			const data = await absGet<AbsListeningSessionsPage>(
				config,
				`/api/me/listening-sessions?itemsPerPage=${PAGE_SIZE}&page=${page}`
			);
			const sessions = data.sessions ?? [];

			for (const s of sessions) {
				if (s.mediaType !== 'book' || typeof s.startedAt !== 'number') continue;
				if (s.startedAt < yearStart || s.startedAt >= yearEnd) continue;
				const date = dateInAppTz(s.startedAt);
				const day = dayMap.get(date) ?? { date, seconds: 0, sessionCount: 0, itemIds: [] };
				// Raw float seconds; rounding happens once per day when merging
				day.seconds += Number.isFinite(s.timeListening) ? (s.timeListening as number) : 0;
				day.sessionCount++;
				if (s.libraryItemId && !day.itemIds.includes(s.libraryItemId)) day.itemIds.push(s.libraryItemId);
				dayMap.set(date, day);
			}

			// Sessions come newest first by updatedAt (>= startedAt): once a whole page predates the year, stop
			const pageBeforeYear =
				sessions.length > 0 && sessions.every((s) => typeof s.updatedAt === 'number' && s.updatedAt < yearStart);
			if (sessions.length === 0 || pageBeforeYear || page >= (data.numPages ?? 0) - 1) break;
		}

		const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
		return truncated ? { available: true, days, error: 'truncated' } : { available: true, days };
	} catch (err) {
		const message = describeError(err);
		log.warn('ABS listening history unavailable', { year, error: message });
		return { available: false, days: [], error: message };
	}
}

/** Per-day ABS listening for an app-timezone calendar year. Never throws; cached for 60s per server + year. */
export async function getAbsListeningByDay(year: number): Promise<AbsListeningResult> {
	const config = await getAbsConfig();
	if (!isUsable(config)) return { available: false, days: [] };

	const key = `${config.baseUrl}|${year}`;
	const now = Date.now();
	const cached = listeningCache.get(key);
	if (cached && now - cached.at < LISTENING_CACHE_TTL_MS) return cached.promise;

	const promise = fetchListeningByDay(config, year);
	listeningCache.set(key, { at: now, promise });
	return promise;
}

// ============================================
// Scheduler
// ============================================

const SCHEDULER_KEY = Symbol.for('bookshelf.absScheduler');
type SchedulerGlobal = typeof globalThis & { [SCHEDULER_KEY]?: ReturnType<typeof setInterval> };

async function schedulerTick(): Promise<void> {
	try {
		const config = await getAbsConfig();
		if (!isUsable(config)) return;

		// Re-read each tick so interval changes apply without a restart
		const intervalMs = (await getAbsSyncIntervalHours()) * 60 * 60 * 1000;
		const lastSync = await getSetting('integration.abs_last_sync');
		const lastTime = lastSync ? new Date(lastSync).getTime() : 0;
		if (!Number.isNaN(lastTime) && Date.now() - lastTime < intervalMs) return;

		await runAbsSync();
	} catch (err) {
		log.error('Audiobookshelf scheduled sync crashed', { error: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * Start the background sync loop (idempotent). Checks every 15 minutes and
 * runs a sync when enabled and the last run is older than the configured interval.
 */
export function startAbsScheduler(): void {
	const g = globalThis as SchedulerGlobal;
	if (g[SCHEDULER_KEY]) return;

	const first = setTimeout(() => void schedulerTick(), SCHEDULER_FIRST_TICK_MS);
	first.unref?.();
	const interval = setInterval(() => void schedulerTick(), SCHEDULER_TICK_MS);
	interval.unref?.();
	g[SCHEDULER_KEY] = interval;
}
