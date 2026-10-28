/**
 * Widget Service
 * Per-user embeddable widgets: each widget belongs to one user and is served
 * only by its capability key. Also holds the v1 API token and toggle helpers.
 */

import { db } from '$lib/server/db';
import {
	books,
	authors,
	series,
	bookAuthors,
	bookSeries,
	readingGoals,
	settings,
	statuses,
	userBooks,
	users,
	widgetInstances
} from '$lib/server/db/schema';
import { eq, sql, desc, asc, and, or, isNull, isNotNull, gte, lt, gt, ne, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { currentYearInAppTz, todayInAppTz } from '$lib/server/utils/appTime';
import crypto from 'crypto';
import { createLogger } from './loggerService';

const log = createLogger('widgets');

// Widget types
export const WIDGET_TYPES = ['currently-reading', 'recent-reads', 'stats', 'goal', 'next-up', 'upcoming-releases'] as const;
export const WIDGET_THEMES = ['light', 'dark'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type WidgetTheme = (typeof WIDGET_THEMES)[number];

// Types whose output is a book list (and so use itemLimit)
export const LIST_WIDGET_TYPES: readonly WidgetType[] = ['currently-reading', 'recent-reads', 'next-up', 'upcoming-releases'];

export const MAX_WIDGETS_PER_USER = 20;
export const WIDGET_NAME_MAX = 100;
const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 1;
const MAX_LIMIT = 20;
const LAST_FETCHED_GAP_MS = 60_000;

// 32 random bytes as base64url, no padding
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const KEY_PREFIX_LENGTH = 6;

export function isWidgetType(value: unknown): value is WidgetType {
	return typeof value === 'string' && (WIDGET_TYPES as readonly string[]).includes(value);
}

export function isWidgetTheme(value: unknown): value is WidgetTheme {
	return typeof value === 'string' && (WIDGET_THEMES as readonly string[]).includes(value);
}

/**
 * Clamp an item limit to 1..20. Anything non-numeric (or 0) falls back to 5.
 * Used on write and again on read, so junk in the DB can never reach SQL LIMIT.
 */
export function clampLimit(n: unknown): number {
	const parsed = typeof n === 'number' ? Math.trunc(n) : parseInt(String(n ?? ''), 10);
	if (!Number.isFinite(parsed) || parsed === 0) return DEFAULT_LIMIT;
	return Math.max(MIN_LIMIT, Math.min(parsed, MAX_LIMIT));
}

export interface WidgetBook {
	id: number;
	title: string;
	coverUrl: string | null;
	author: string | null;
	series: string | null;
	bookNum: number | null;
	rating: number | null;
	releaseDate?: string | null;
}

export interface WidgetStats {
	totalBooks: number;
	booksRead: number;
	currentlyReading: number;
	booksThisYear: number;
	avgRating: number | null;
	totalAuthors: number;
	totalSeries: number;
	completionPercent: number;
}

export interface WidgetGoal {
	year: number;
	target: number;
	current: number;
	remaining: number;
	percent: number;
}

export interface WidgetData {
	books?: WidgetBook[];
	stats?: WidgetStats;
	goal?: WidgetGoal | null;
}

// Owner-facing widget record (never includes the key or its hash)
export interface WidgetInfo {
	id: number;
	name: string | null;
	type: WidgetType;
	theme: WidgetTheme;
	itemLimit: number;
	keyPrefix: string;
	createdAt: string | null;
	lastFetchedAt: string | null;
	disabled: boolean;
}

// Admin registry row (no key, prefix or data)
export interface AdminWidgetInfo {
	id: number;
	ownerId: number;
	ownerUsername: string | null;
	name: string | null;
	type: string;
	createdAt: string | null;
	lastFetchedAt: string | null;
	disabledAt: string | null;
}

// Row matched by key when serving
export interface ResolvedWidget {
	id: number;
	userId: number;
	type: WidgetType;
	theme: WidgetTheme;
	itemLimit: number;
	lastFetchedAt: string | null;
}

// Status IDs (matching the default statuses)
const STATUS_CURRENT = 2; // "Currently Reading"
const STATUS_READ = 1; // "Read"
const STATUS_NEXT = 3; // "Next Up"

// Helper to get status ID by key
async function getStatusIdByKey(key: string): Promise<number | null> {
	const result = await db.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, key))
		.limit(1);
	return result[0]?.id ?? null;
}

// Helper to get status ID by name (fallback for custom status names)
async function getStatusIdByName(name: string): Promise<number | null> {
	const result = await db.select({ id: statuses.id })
		.from(statuses)
		.where(sql`LOWER(${statuses.name}) = LOWER(${name})`)
		.limit(1);
	return result[0]?.id ?? null;
}

// Get status ID - tries key first, then name variations
async function getStatusId(key: string, nameVariations: string[]): Promise<number | null> {
	// First try by key
	const byKey = await getStatusIdByKey(key);
	if (byKey) return byKey;

	// Then try by name variations
	for (const name of nameVariations) {
		const byName = await getStatusIdByName(name);
		if (byName) return byName;
	}

	return null;
}

/**
 * Get or create widget token
 */
export async function getWidgetToken(): Promise<string> {
	const result = await db
		.select()
		.from(settings)
		.where(eq(settings.key, 'widget_token'))
		.limit(1);

	if (result[0]?.value) {
		return result[0].value;
	}

	// Generate new token
	const token = crypto.randomBytes(32).toString('hex');
	await db
		.insert(settings)
		.values({
			key: 'widget_token',
			value: token,
			type: 'string',
			category: 'widgets',
			label: 'Widget Access Token',
			description: 'Security token for public widget access',
			isSystem: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: settings.key,
			set: { value: token, updatedAt: new Date().toISOString() }
		});

	return token;
}

/**
 * Validate widget token (constant-time comparison)
 */
export async function validateWidgetToken(token: string): Promise<boolean> {
	if (!token) return false;

	const storedToken = await getWidgetToken();
	const provided = Buffer.from(token, 'utf8');
	const stored = Buffer.from(storedToken, 'utf8');
	if (provided.length !== stored.length) return false;
	return crypto.timingSafeEqual(provided, stored);
}

/**
 * Regenerate widget token (invalidates all existing embeds)
 */
export async function regenerateWidgetToken(): Promise<string> {
	const token = crypto.randomBytes(32).toString('hex');

	await db
		.update(settings)
		.set({ value: token, updatedAt: new Date().toISOString() })
		.where(eq(settings.key, 'widget_token'));

	log.info('Widget token regenerated');
	return token;
}

/**
 * Check if public widgets are enabled. Default OFF: only an explicit 'true' enables them.
 */
export async function areWidgetsEnabled(): Promise<boolean> {
	const result = await db
		.select()
		.from(settings)
		.where(eq(settings.key, 'widgets_enabled'))
		.limit(1);

	return result[0]?.value === 'true';
}

/**
 * Check if the tokened v1 REST API is enabled. Default ON: only an explicit 'false' disables it.
 * Until api_enabled has been saved, an install that had turned the old shared toggle
 * (widgets_enabled = 'false') off keeps the API off, so nothing is silently re-enabled.
 */
export async function isApiEnabled(): Promise<boolean> {
	const result = await db
		.select()
		.from(settings)
		.where(inArray(settings.key, ['api_enabled', 'widgets_enabled']));

	const api = result.find((r) => r.key === 'api_enabled');
	if (api) return api.value !== 'false';
	return result.find((r) => r.key === 'widgets_enabled')?.value !== 'false';
}

/**
 * Toggle the v1 REST API enabled/disabled
 */
export async function setApiEnabled(enabled: boolean): Promise<void> {
	const value = enabled ? 'true' : 'false';

	await db
		.insert(settings)
		.values({
			key: 'api_enabled',
			value,
			type: 'boolean',
			category: 'widgets',
			label: 'Enable v1 API',
			description: 'Allow tokened access to the /api/v1 REST endpoints',
			isSystem: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: settings.key,
			set: { value, updatedAt: new Date().toISOString() }
		});

	log.info(`v1 API ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Toggle widgets enabled/disabled
 */
export async function setWidgetsEnabled(enabled: boolean): Promise<void> {
	const value = enabled ? 'true' : 'false';

	await db
		.insert(settings)
		.values({
			key: 'widgets_enabled',
			value,
			type: 'boolean',
			category: 'widgets',
			label: 'Enable Public Widgets',
			description: 'Allow public access to widget endpoints',
			isSystem: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: settings.key,
			set: { value, updatedAt: new Date().toISOString() }
		});

	log.info(`Widgets ${enabled ? 'enabled' : 'disabled'}`);
}

// ============================================
// Keys
// ============================================

export function generateKey(): string {
	return crypto.randomBytes(32).toString('base64url');
}

export function hashKey(key: string): string {
	return crypto.createHash('sha256').update(key).digest('hex');
}

// ============================================
// Owner CRUD (every query filtered on userId)
// ============================================

type WidgetRow = typeof widgetInstances.$inferSelect;

function toWidgetInfo(row: WidgetRow): WidgetInfo {
	return {
		id: row.id,
		name: row.name,
		type: row.type as WidgetType,
		theme: isWidgetTheme(row.theme) ? row.theme : 'light',
		itemLimit: clampLimit(row.itemLimit),
		keyPrefix: row.keyPrefix,
		createdAt: row.createdAt,
		lastFetchedAt: row.lastFetchedAt,
		disabled: row.disabledAt !== null
	};
}

type NameResult = { ok: true; name: string | null } | { ok: false; error: string };

function normalizeName(name: unknown): NameResult {
	if (name === undefined || name === null) return { ok: true, name: null };
	if (typeof name !== 'string') return { ok: false, error: 'Name must be a string' };
	const trimmed = name.trim();
	if (trimmed.length > WIDGET_NAME_MAX) {
		return { ok: false, error: `Name must be ${WIDGET_NAME_MAX} characters or less` };
	}
	return { ok: true, name: trimmed || null };
}

export async function listWidgets(userId: number): Promise<WidgetInfo[]> {
	const rows = await db
		.select()
		.from(widgetInstances)
		.where(eq(widgetInstances.userId, userId))
		.orderBy(desc(widgetInstances.id));

	return rows.map(toWidgetInfo);
}

export interface CreateWidgetInput {
	type: unknown;
	theme?: unknown;
	itemLimit?: unknown;
	name?: unknown;
}

export type WidgetKeyResult =
	| { success: true; widget: WidgetInfo; key: string }
	| { success: false; error: string };

export async function createWidget(userId: number, input: CreateWidgetInput): Promise<WidgetKeyResult> {
	if (!isWidgetType(input.type)) {
		return { success: false, error: `Invalid widget type. Must be one of: ${WIDGET_TYPES.join(', ')}` };
	}
	const theme = input.theme === undefined || input.theme === null ? 'light' : input.theme;
	if (!isWidgetTheme(theme)) {
		return { success: false, error: 'Invalid theme. Must be light or dark' };
	}
	const name = normalizeName(input.name);
	if (!name.ok) return { success: false, error: name.error };

	const [countRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(widgetInstances)
		.where(eq(widgetInstances.userId, userId));
	if ((countRow?.count ?? 0) >= MAX_WIDGETS_PER_USER) {
		return { success: false, error: `You can have at most ${MAX_WIDGETS_PER_USER} widgets` };
	}

	const key = generateKey();
	const now = new Date().toISOString();
	const [row] = await db
		.insert(widgetInstances)
		.values({
			userId,
			name: name.name,
			type: input.type,
			theme,
			itemLimit: clampLimit(input.itemLimit),
			keyHash: hashKey(key),
			keyPrefix: key.slice(0, KEY_PREFIX_LENGTH),
			createdAt: now,
			updatedAt: now
		})
		.returning();

	log.info('Widget created', { widgetId: row.id, userId, type: input.type });
	return { success: true, widget: toWidgetInfo(row), key };
}

export interface UpdateWidgetInput {
	name?: unknown;
	theme?: unknown;
	itemLimit?: unknown;
}

export type UpdateWidgetResult =
	| { success: true; widget: WidgetInfo }
	| { success: false; error: string; notFound?: boolean; disabled?: boolean };

export async function updateWidget(id: number, userId: number, patch: UpdateWidgetInput): Promise<UpdateWidgetResult> {
	const updates: Partial<WidgetRow> = {};

	if (patch.name !== undefined) {
		const name = normalizeName(patch.name);
		if (!name.ok) return { success: false, error: name.error };
		updates.name = name.name;
	}
	if (patch.theme !== undefined) {
		if (!isWidgetTheme(patch.theme)) return { success: false, error: 'Invalid theme. Must be light or dark' };
		updates.theme = patch.theme;
	}
	if (patch.itemLimit !== undefined) {
		updates.itemLimit = clampLimit(patch.itemLimit);
	}

	const [existing] = await db
		.select()
		.from(widgetInstances)
		.where(and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)))
		.limit(1);
	if (!existing) return { success: false, error: 'Widget not found', notFound: true };
	if (existing.disabledAt) {
		return { success: false, error: 'This widget was disabled by an administrator', disabled: true };
	}

	if (Object.keys(updates).length === 0) {
		return { success: true, widget: toWidgetInfo(existing) };
	}

	const [row] = await db
		.update(widgetInstances)
		.set({ ...updates, updatedAt: new Date().toISOString() })
		.where(and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)))
		.returning();
	if (!row) return { success: false, error: 'Widget not found', notFound: true };

	return { success: true, widget: toWidgetInfo(row) };
}

export type RotateWidgetResult = WidgetKeyResult | { success: false; error: string; notFound?: boolean; disabled?: boolean };

/**
 * Issue a new key; the old URL stops working. Never touches disabledAt,
 * so an owner can't undo an admin disable by rotating.
 */
export async function rotateWidgetKey(id: number, userId: number): Promise<RotateWidgetResult> {
	const [existing] = await db
		.select({ id: widgetInstances.id, disabledAt: widgetInstances.disabledAt })
		.from(widgetInstances)
		.where(and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)))
		.limit(1);
	if (!existing) return { success: false, error: 'Widget not found', notFound: true };
	if (existing.disabledAt) {
		return { success: false, error: 'This widget was disabled by an administrator', disabled: true };
	}

	const key = generateKey();
	const now = new Date().toISOString();
	const [row] = await db
		.update(widgetInstances)
		.set({ keyHash: hashKey(key), keyPrefix: key.slice(0, KEY_PREFIX_LENGTH), rotatedAt: now, updatedAt: now })
		.where(and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId), isNull(widgetInstances.disabledAt)))
		.returning();
	if (!row) return { success: false, error: 'Widget not found', notFound: true };

	log.info('Widget key rotated', { widgetId: id, userId });
	return { success: true, widget: toWidgetInfo(row), key };
}

/**
 * Revoke a widget (deletes the row). Allowed even when an admin disabled it.
 */
export async function deleteWidget(id: number, userId: number): Promise<boolean> {
	const result = await db
		.delete(widgetInstances)
		.where(and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)));

	if (result.changes > 0) {
		log.info('Widget deleted', { widgetId: id, userId });
		return true;
	}
	return false;
}

// ============================================
// Serving (key is the only credential)
// ============================================

/**
 * Find the live widget for a key. Returns null for a malformed or unknown key,
 * a disabled widget, a type mismatch or a deleted owner (inner join on users).
 * The master toggle is checked by the caller before this runs.
 */
export async function resolveWidget(key: string, type: string): Promise<ResolvedWidget | null> {
	if (!KEY_RE.test(key) || !isWidgetType(type)) return null;

	const [row] = await db
		.select({
			id: widgetInstances.id,
			userId: widgetInstances.userId,
			type: widgetInstances.type,
			theme: widgetInstances.theme,
			itemLimit: widgetInstances.itemLimit,
			lastFetchedAt: widgetInstances.lastFetchedAt
		})
		.from(widgetInstances)
		.innerJoin(users, eq(widgetInstances.userId, users.id))
		.where(
			and(
				eq(widgetInstances.keyHash, hashKey(key)),
				isNull(widgetInstances.disabledAt),
				eq(widgetInstances.type, type)
			)
		)
		.limit(1);

	if (!row) return null;

	return {
		id: row.id,
		userId: row.userId,
		type: row.type as WidgetType,
		theme: isWidgetTheme(row.theme) ? row.theme : 'light',
		itemLimit: clampLimit(row.itemLimit),
		lastFetchedAt: row.lastFetchedAt
	};
}

/**
 * Record a fetch, at most one write per widget per minute
 */
export async function touchLastFetched(row: Pick<ResolvedWidget, 'id' | 'lastFetchedAt'>): Promise<void> {
	const nowMs = Date.now();
	if (row.lastFetchedAt) {
		const last = Date.parse(row.lastFetchedAt);
		if (Number.isFinite(last) && nowMs - last < LAST_FETCHED_GAP_MS) return;
	}

	const cutoff = new Date(nowMs - LAST_FETCHED_GAP_MS).toISOString();
	await db
		.update(widgetInstances)
		.set({ lastFetchedAt: new Date(nowMs).toISOString() })
		.where(
			and(
				eq(widgetInstances.id, row.id),
				or(isNull(widgetInstances.lastFetchedAt), lt(widgetInstances.lastFetchedAt, cutoff))
			)
		);
}

// ============================================
// Admin
// ============================================

export async function listAllWidgetsForAdmin(): Promise<AdminWidgetInfo[]> {
	return db
		.select({
			id: widgetInstances.id,
			ownerId: widgetInstances.userId,
			ownerUsername: users.username,
			name: widgetInstances.name,
			type: widgetInstances.type,
			createdAt: widgetInstances.createdAt,
			lastFetchedAt: widgetInstances.lastFetchedAt,
			disabledAt: widgetInstances.disabledAt
		})
		.from(widgetInstances)
		.leftJoin(users, eq(widgetInstances.userId, users.id))
		.orderBy(desc(widgetInstances.id));
}

export async function setWidgetDisabled(id: number, adminId: number, disabled: boolean): Promise<boolean> {
	const now = new Date().toISOString();
	const result = await db
		.update(widgetInstances)
		.set(
			disabled
				? { disabledAt: now, disabledBy: adminId, updatedAt: now }
				: { disabledAt: null, disabledBy: null, updatedAt: now }
		)
		.where(eq(widgetInstances.id, id));

	if (result.changes > 0) {
		log.info(`Widget ${disabled ? 'disabled' : 'enabled'} by admin`, { widgetId: id, adminId });
		return true;
	}
	return false;
}

// ============================================
// Widget data (always scoped to the owner's user_books)
// ============================================

type OwnerBookRow = {
	id: number;
	title: string;
	coverImageUrl: string | null;
	rating: number | null;
	releaseDate: string | null;
};

/**
 * Primary author, primary series and book number per book, from the junction
 * tables (primary first, then displayOrder), the same rule getBooksCardData uses
 */
async function attachAuthorSeries(rows: OwnerBookRow[], withReleaseDate = false): Promise<WidgetBook[]> {
	if (rows.length === 0) return [];
	const bookIds = rows.map((r) => r.id);

	const [authorRows, seriesRows] = await Promise.all([
		db
			.select({ bookId: bookAuthors.bookId, name: authors.name })
			.from(bookAuthors)
			.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
			.where(inArray(bookAuthors.bookId, bookIds))
			.orderBy(asc(bookAuthors.bookId), desc(bookAuthors.isPrimary), asc(bookAuthors.displayOrder)),
		db
			.select({ bookId: bookSeries.bookId, title: series.title, bookNum: bookSeries.bookNum })
			.from(bookSeries)
			.innerJoin(series, eq(bookSeries.seriesId, series.id))
			.where(inArray(bookSeries.bookId, bookIds))
			.orderBy(asc(bookSeries.bookId), desc(bookSeries.isPrimary), asc(bookSeries.displayOrder))
	]);

	const authorByBook = new Map<number, string>();
	for (const a of authorRows) {
		if (!authorByBook.has(a.bookId)) authorByBook.set(a.bookId, a.name);
	}
	const seriesByBook = new Map<number, { title: string; bookNum: number | null }>();
	for (const s of seriesRows) {
		if (!seriesByBook.has(s.bookId)) seriesByBook.set(s.bookId, { title: s.title, bookNum: s.bookNum });
	}

	return rows.map((row) => {
		const s = seriesByBook.get(row.id);
		const book: WidgetBook = {
			id: row.id,
			title: row.title,
			coverUrl: row.coverImageUrl,
			author: authorByBook.get(row.id) ?? null,
			series: s?.title ?? null,
			bookNum: s?.bookNum ?? null,
			rating: row.rating
		};
		if (withReleaseDate) book.releaseDate = row.releaseDate;
		return book;
	});
}

// The owner's user_books joined to books, with the owner's own rating
async function selectOwnerBooks(
	ownerId: number,
	condition: SQL | undefined,
	orderBy: SQL,
	limit: number
): Promise<OwnerBookRow[]> {
	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			rating: userBooks.rating,
			releaseDate: books.releaseDate
		})
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(and(eq(userBooks.userId, ownerId), condition))
		.orderBy(orderBy)
		.limit(clampLimit(limit));
}

function readStatus(): Promise<number | null> {
	return getStatusId('READ', ['Done', 'Read', 'Completed', 'Finished']);
}

function currentStatus(): Promise<number | null> {
	return getStatusId('CURRENT', ['Currently Reading', 'Current', 'Reading']);
}

/**
 * Get the owner's currently reading books
 */
export async function getCurrentlyReading(ownerId: number, limit: number = DEFAULT_LIMIT): Promise<WidgetBook[]> {
	const currentStatusId = (await currentStatus()) ?? STATUS_CURRENT;
	const rows = await selectOwnerBooks(ownerId, eq(userBooks.statusId, currentStatusId), desc(userBooks.updatedAt), limit);
	return attachAuthorSeries(rows);
}

/**
 * Get the owner's recently finished books (newest completion first)
 */
export async function getRecentReads(ownerId: number, limit: number = DEFAULT_LIMIT): Promise<WidgetBook[]> {
	const readStatusId = (await readStatus()) ?? STATUS_READ;
	const rows = await selectOwnerBooks(
		ownerId,
		and(eq(userBooks.statusId, readStatusId), isNotNull(userBooks.completedDate), ne(userBooks.completedDate, '')),
		desc(userBooks.completedDate),
		limit
	);
	return attachAuthorSeries(rows);
}

/**
 * Get the owner's Next Up books
 */
export async function getNextUp(ownerId: number, limit: number = DEFAULT_LIMIT): Promise<WidgetBook[]> {
	const nextStatusId = (await getStatusId('NEXT', ['Next', 'To Read', 'Up Next', 'TBR'])) ?? STATUS_NEXT;
	const rows = await selectOwnerBooks(ownerId, eq(userBooks.statusId, nextStatusId), desc(userBooks.updatedAt), limit);
	return attachAuthorSeries(rows);
}

/**
 * Get the owner's books with a release date today or later (soonest first)
 */
export async function getUpcomingReleases(ownerId: number, limit: number = DEFAULT_LIMIT): Promise<WidgetBook[]> {
	const today = todayInAppTz(); // YYYY-MM-DD in the app timezone
	const rows = await selectOwnerBooks(
		ownerId,
		and(isNotNull(books.releaseDate), gte(books.releaseDate, today)),
		asc(books.releaseDate),
		limit
	);
	return attachAuthorSeries(rows, true);
}

/**
 * Get the owner's reading statistics
 */
export async function getWidgetStats(ownerId: number): Promise<WidgetStats> {
	const currentYear = currentYearInAppTz();
	const yearStart = `${currentYear}-01-01`;
	const nextYearStart = `${currentYear + 1}-01-01`;

	const [readStatusId, currentStatusId] = await Promise.all([readStatus(), currentStatus()]);
	const owned = eq(userBooks.userId, ownerId);
	const ownerBookIds = db.select({ bookId: userBooks.bookId }).from(userBooks).where(owned);

	const countWhere = async (condition: SQL | undefined): Promise<number> => {
		const [row] = await db.select({ count: sql<number>`count(*)` }).from(userBooks).where(and(owned, condition));
		return row?.count || 0;
	};

	const [totalBooks, booksRead, currentlyReading, booksThisYear] = await Promise.all([
		countWhere(undefined),
		readStatusId ? countWhere(eq(userBooks.statusId, readStatusId)) : Promise.resolve(0),
		currentStatusId ? countWhere(eq(userBooks.statusId, currentStatusId)) : Promise.resolve(0),
		readStatusId
			? countWhere(
				and(
					eq(userBooks.statusId, readStatusId),
					gte(userBooks.completedDate, yearStart),
					lt(userBooks.completedDate, nextYearStart)
				)
			)
			: Promise.resolve(0)
	]);

	const [[avgResult], [authorsResult], [seriesResult]] = await Promise.all([
		db.select({ avg: sql<number | null>`avg(${userBooks.rating})` }).from(userBooks).where(and(owned, gt(userBooks.rating, 0))),
		db
			.select({ count: sql<number>`count(distinct ${bookAuthors.authorId})` })
			.from(bookAuthors)
			.where(inArray(bookAuthors.bookId, ownerBookIds)),
		db
			.select({ count: sql<number>`count(distinct ${bookSeries.seriesId})` })
			.from(bookSeries)
			.where(inArray(bookSeries.bookId, ownerBookIds))
	]);

	return {
		totalBooks,
		booksRead,
		currentlyReading,
		booksThisYear,
		avgRating: avgResult?.avg ? Math.round(avgResult.avg * 10) / 10 : null,
		totalAuthors: authorsResult?.count || 0,
		totalSeries: seriesResult?.count || 0,
		completionPercent: totalBooks > 0 ? Math.round((booksRead / totalBooks) * 100) : 0
	};
}

/**
 * Get the owner's progress toward this year's reading goal.
 * The target is the global goal row (goals have no owner); the count is the owner's.
 */
export async function getWidgetGoal(ownerId: number): Promise<WidgetGoal | null> {
	const currentYear = currentYearInAppTz();

	// Same pick as goalsService.getActiveGoal: active, challengeType 'books' or null
	const [goal] = await db
		.select()
		.from(readingGoals)
		.where(
			and(
				eq(readingGoals.year, currentYear),
				eq(readingGoals.isActive, true),
				or(eq(readingGoals.challengeType, 'books'), isNull(readingGoals.challengeType))
			)
		)
		.limit(1);

	if (!goal || !goal.targetBooks) {
		return null;
	}

	const readStatusId = await readStatus();
	let current = 0;
	if (readStatusId) {
		const [countResult] = await db
			.select({ count: sql<number>`COALESCE(SUM(COALESCE(${books.booksContained}, 1)), 0)` })
			.from(userBooks)
			.innerJoin(books, eq(userBooks.bookId, books.id))
			.where(
				and(
					eq(userBooks.userId, ownerId),
					eq(userBooks.statusId, readStatusId),
					gte(userBooks.completedDate, `${currentYear}-01-01`),
					lt(userBooks.completedDate, `${currentYear + 1}-01-01`)
				)
			);
		current = countResult?.count || 0;
	}

	const target = goal.targetBooks;
	const remaining = Math.max(0, target - current);
	const percent = Math.min(100, Math.round((current / target) * 100));

	return {
		year: currentYear,
		target,
		current,
		remaining,
		percent
	};
}

/**
 * Get widget data for one owner based on type
 */
export async function getWidgetData(type: WidgetType, ownerId: number, limit: number = DEFAULT_LIMIT): Promise<WidgetData> {
	const safeLimit = clampLimit(limit);
	switch (type) {
		case 'currently-reading':
			return { books: await getCurrentlyReading(ownerId, safeLimit) };
		case 'recent-reads':
			return { books: await getRecentReads(ownerId, safeLimit) };
		case 'stats':
			return { stats: await getWidgetStats(ownerId) };
		case 'goal':
			return { goal: await getWidgetGoal(ownerId) };
		case 'next-up':
			return { books: await getNextUp(ownerId, safeLimit) };
		case 'upcoming-releases':
			return { books: await getUpcomingReleases(ownerId, safeLimit) };
		default:
			throw new Error(`Unknown widget type: ${type satisfies never}`);
	}
}
