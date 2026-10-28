/**
 * Audiobookshelf integration: config, REST client, item helpers and the read-only features
 *
 * Configured entirely from Admin → Settings → Integrations:
 *   integration.abs_enabled   - master toggle
 *   integration.abs_base_url  - ABS server URL
 *   integration.abs_api_key   - ABS API key (sent as Authorization: Bearer)
 *
 * When the integration is disabled or not configured, every public function no-ops.
 *
 * The item sync (match/link, create, series pushback, stale check, status sync) lives in
 * absSyncService; status only ever flows Audiobookshelf → BookShelf.
 *
 * Linked books carry the "Audiobook Shelf" system tag. Links made here tag the book
 * immediately; every sync also self-heals drift (tag = absItemId IS NOT NULL).
 */

import { db } from '$lib/server/db';
import { books, authors, bookAuthors, bookTags, narrators, formats, statuses, tags } from '$lib/server/db/schema';
import { and, asc, count, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { getSetting, getSettingAs } from './settingsService';
import { createLogger } from './loggerService';
import { dateInAppTz, startOfDayInAppTz } from '$lib/server/utils/appTime';

const log = createLogger('abs');

const REQUEST_TIMEOUT_MS = 15_000;
export const ABS_PAGE_SIZE = 100;
const PAGE_SIZE = ABS_PAGE_SIZE;
const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;
const UNLINKED_LIST_LIMIT = 500;
const ABS_TAG_NAME = 'Audiobook Shelf';
const AUTO_ADDED_TAG_NAME = 'Auto-Added';

// ============================================
// Types
// ============================================

export interface AbsConfig {
	enabled: boolean;
	baseUrl: string;
	apiKey: string;
}

export interface AbsLibrary {
	id: string;
	name: string;
	mediaType?: string;
}

export interface AbsBookMetadata {
	title?: string | null;
	asin?: string | null;
	isbn?: string | null;
	seriesName?: string | null;
	series?: { id?: string; name: string; sequence?: string | null }[];
	authors?: { id?: string; name: string }[];
	authorName?: string | null;
	narrators?: string[];
	narratorName?: string | null;
}

export interface AbsLibraryItem {
	id: string;
	libraryId?: string;
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
export interface AbsExpandedItem {
	id: string;
	libraryId?: string;
	size?: number;
	media?: {
		metadata?: AbsBookMetadata & {
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
export interface AbsMediaProgress {
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

export function isUsable(config: AbsConfig): boolean {
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

// ============================================
// REST client
// ============================================

/** Non-2xx response from ABS (network failures stay plain fetch errors) */
export class AbsHttpError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
	}
}

export async function absGet<T>(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>, path: string): Promise<T> {
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
export async function absPatch(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>, path: string, body: unknown): Promise<void> {
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

export async function getLibraries(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>): Promise<AbsLibrary[]> {
	const data = await absGet<{ libraries?: AbsLibrary[] }>(config, '/api/libraries');
	return data.libraries ?? [];
}

export function pickAudiobookLibrary(libraries: AbsLibrary[]): AbsLibrary | null {
	return libraries.find((l) => l.name.toLowerCase().includes('audiobook')) ?? libraries[0] ?? null;
}

async function searchLibrary(config: AbsConfig, libraryId: string, query: string): Promise<AbsLibraryItem[]> {
	const data = await absGet<{ book?: { libraryItem: AbsLibraryItem }[] }>(
		config,
		`/api/libraries/${encodeURIComponent(libraryId)}/search?q=${encodeURIComponent(query)}`
	);
	return (data.book ?? []).map((r) => r.libraryItem).filter((item) => !!item?.id);
}

/** One page of library items; asks for full items (minified=0), the parsers still accept both shapes. */
export async function getLibraryItemsPage(
	config: AbsConfig,
	libraryId: string,
	page: number
): Promise<{ results: AbsLibraryItem[]; total: number }> {
	const data = await absGet<{ results?: AbsLibraryItem[]; total?: number }>(
		config,
		`/api/libraries/${encodeURIComponent(libraryId)}/items?limit=${PAGE_SIZE}&page=${page}&minified=0`
	);
	return { results: data.results ?? [], total: data.total ?? 0 };
}

/** One expanded item, or null when ABS answers 404 (other failures throw AbsHttpError / fetch errors). */
export async function getAbsItemOrNull(config: AbsConfig, itemId: string): Promise<AbsExpandedItem | null> {
	try {
		return await absGet<AbsExpandedItem>(config, `/api/items/${encodeURIComponent(itemId)}?expanded=1`);
	} catch (err) {
		if (err instanceof AbsHttpError && err.status === 404) return null;
		throw err;
	}
}

/**
 * PATCH an item's media metadata. Only the keys sent are changed; metadata.series replaces
 * the whole array, which is why callers only send it when the item has none.
 */
export async function absPatchItemMedia(config: AbsConfig, itemId: string, metadata: Record<string, unknown>): Promise<void> {
	await absPatch(config, `/api/items/${encodeURIComponent(itemId)}/media`, { metadata });
}

export function describeError(err: unknown): string {
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

export function itemTitle(item: AbsLibraryItem): string {
	return item.media?.metadata?.title?.trim() ?? '';
}

// Full items carry arrays; minified items carry comma-joined names
export function itemAuthors(item: AbsLibraryItem): string[] {
	const meta = item.media?.metadata;
	if (meta?.authors?.length) return meta.authors.map((a) => a.name.trim()).filter(Boolean);
	return (meta?.authorName ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function itemNarrators(item: AbsLibraryItem): string[] {
	const meta = item.media?.metadata;
	if (meta?.narrators?.length) return meta.narrators.map((n) => n.trim()).filter(Boolean);
	return (meta?.narratorName ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

// ============================================
// Row resolution (ensure rows exist before creating books)
// ============================================

export async function ensureNarrator(name: string): Promise<number> {
	const [existing] = await db.select({ id: narrators.id }).from(narrators)
		.where(sql`LOWER(${narrators.name}) = LOWER(${name})`).limit(1);
	if (existing) return existing.id;
	const now = new Date().toISOString();
	const [created] = await db.insert(narrators).values({ name, createdAt: now, updatedAt: now }).returning({ id: narrators.id });
	return created.id;
}

// Prefers "Audio"; reuses the stock "Audiobook" format on fresh installs before creating "Audio"
export async function ensureAudioFormat(): Promise<number> {
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
export async function getAudioFormatIds(): Promise<number[]> {
	const rows = await db.select({ id: formats.id }).from(formats)
		.where(sql`LOWER(${formats.name}) LIKE '%audio%'`)
		.orderBy(asc(formats.id));
	return rows.map((r) => r.id);
}

export async function getUnreadStatusId(): Promise<number | null> {
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
export async function ensureAbsTag(): Promise<number> {
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

// "Auto-Added" marks books the sync created, so they can be reviewed; reuses a user-made tag of that name
export async function ensureAutoAddedTag(): Promise<number> {
	const [existing] = await db.select({ id: tags.id, isSystem: tags.isSystem }).from(tags)
		.where(sql`LOWER(${tags.name}) = LOWER(${AUTO_ADDED_TAG_NAME})`).limit(1);
	const now = new Date().toISOString();
	if (existing) {
		if (!existing.isSystem) await db.update(tags).set({ isSystem: true, updatedAt: now }).where(eq(tags.id, existing.id));
		return existing.id;
	}
	const [created] = await db.insert(tags)
		.values({ name: AUTO_ADDED_TAG_NAME, color: '#0ea5e9', icon: 'sparkles', isSystem: true, createdAt: now, updatedAt: now })
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
export async function healAbsTags(tagId: number): Promise<{ added: number; removed: number }> {
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

export function toAbsProgress(p: AbsMediaProgress): AbsProgress {
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

/** The API key user's progress for every book item, in one GET /api/me (podcast episodes skipped). */
export async function fetchProgressByItem(config: AbsConfig): Promise<Map<string, AbsMediaProgress>> {
	const me = await absGet<{ mediaProgress?: AbsMediaProgress[] }>(config, '/api/me');
	const progressByItem = new Map<string, AbsMediaProgress>();
	for (const p of me.mediaProgress ?? []) {
		if (p.libraryItemId && !p.episodeId) progressByItem.set(p.libraryItemId, p);
	}
	return progressByItem;
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
