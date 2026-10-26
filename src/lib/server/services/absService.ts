/**
 * Audiobookshelf integration
 *
 * Configured entirely from Admin → Settings → Integrations:
 *   integration.abs_enabled   - master toggle
 *   integration.abs_base_url  - ABS server URL
 *   integration.abs_api_key   - ABS API key (sent as x-api-key)
 *   integration.abs_sync_interval_hours - hours between automatic syncs (1-48)
 *
 * When the integration is disabled or not configured, every public function no-ops.
 *
 * Sync runs two passes:
 *   1. Link pass   - recently added, unlinked books are matched to ABS items
 *                    (ASIN-exact first, then a single exact-title hit).
 *   2. Reverse sync - every ABS library item without a BookShelf book is created
 *                    born-linked; an unlinked exact-title book is linked instead.
 */

import { db } from '$lib/server/db';
import { books, authors, bookAuthors, narrators, formats, statuses, users } from '$lib/server/db/schema';
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getSetting, getSettingAs, setSetting } from './settingsService';
import { createBook } from './bookService';
import { createLogger } from './loggerService';

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
	durationMs: number;
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

async function absGet<T>(config: Pick<AbsConfig, 'baseUrl' | 'apiKey'>, path: string): Promise<T> {
	const res = await fetch(`${config.baseUrl}${path}`, {
		headers: { 'x-api-key': config.apiKey, Accept: 'application/json' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!res.ok) {
		const reason = res.status === 401 || res.status === 403 ? 'API key rejected' : res.statusText;
		throw new Error(`Audiobookshelf returned ${res.status}${reason ? ` (${reason})` : ''} for ${path.split('?')[0]}`);
	}
	return (await res.json()) as T;
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
	const now = new Date().toISOString();
	const [created] = await db.insert(formats)
		.values({ name: 'Audio', icon: 'headphones', color: '#6c757d', createdAt: now, updatedAt: now })
		.returning({ id: formats.id });
	return created.id;
}

async function getAudioFormatIds(): Promise<number[]> {
	const rows = await db.select({ id: formats.id }).from(formats)
		.where(sql`LOWER(${formats.name}) IN ('audio', 'audiobook')`);
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

async function getDefaultOwnerId(): Promise<number | null> {
	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
	return user?.id ?? null;
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
async function runLinkPass(config: AbsConfig, libraryId: string, usedItemIds: Set<string>): Promise<{ linked: number; errors: number }> {
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
async function runReverseSync(config: AbsConfig, libraryId: string, usedItemIds: Set<string>): Promise<{ linked: number; created: number; errors: number }> {
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
					absItemId: item.id
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

let activeSync: Promise<AbsSyncResult> | null = null;

/** Run one full sync (link pass + reverse sync). Concurrent calls share the in-flight run. */
export function runAbsSync(): Promise<AbsSyncResult> {
	if (!activeSync) {
		activeSync = doSync().finally(() => {
			activeSync = null;
		});
	}
	return activeSync;
}

async function doSync(): Promise<AbsSyncResult> {
	const started = Date.now();
	const empty = { linked: 0, created: 0, errors: 0 };
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
		const library = pickAudiobookLibrary(await getLibraries(config));
		if (!library) {
			return { ok: false, error: 'No libraries found on Audiobookshelf', ...empty, durationMs: Date.now() - started };
		}

		const linkedRows = await db.select({ absItemId: books.absItemId }).from(books)
			.where(sql`${books.absItemId} IS NOT NULL`);
		const usedItemIds = new Set(linkedRows.map((r) => r.absItemId as string));

		const linkPass = await runLinkPass(config, library.id, usedItemIds);
		const reverse = await runReverseSync(config, library.id, usedItemIds);

		await setSetting('integration.abs_last_sync', new Date().toISOString());

		const result: AbsSyncResult = {
			ok: true,
			linked: linkPass.linked + reverse.linked,
			created: reverse.created,
			errors: linkPass.errors + reverse.errors,
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
