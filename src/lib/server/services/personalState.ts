/**
 * Personal reading state (2.30.0): status, rating, notes, reading dates, DNF details and reading
 * position belong to the viewer's own user_books row, never to the shared books row. Every read
 * goes through personalCols / personalJoinSql / overlayPersonal so a viewer only ever sees their
 * own state; a book without a row for the viewer reads as having none.
 */
import { db, books, userBooks, statuses } from '$lib/server/db';
import { alias } from 'drizzle-orm/sqlite-core';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Book } from '$lib/server/db/schema';
import { holdsBook } from './libraryShareService';

/** The viewer's user_books row, aliased so it never collides with other user_books joins */
export const viewerBooks = alias(userBooks, 'vub');

/** No viewer: a join on this id matches nothing, so every personal field reads as null */
const NO_VIEWER = -1;

/** The book-shaped personal fields, in the same names the books row used */
export const PERSONAL_FIELDS = [
	'statusId',
	'rating',
	'comments',
	'startReadingDate',
	'completedDate',
	'dnfPage',
	'dnfPercent',
	'dnfReason',
	'dnfDate',
	'readingProgress',
	'lastReadAt',
	'purchasePrice'
] as const;

export type PersonalFields = Pick<Book, (typeof PERSONAL_FIELDS)[number]>;

export const EMPTY_PERSONAL: PersonalFields = {
	statusId: null,
	rating: null,
	comments: null,
	startReadingDate: null,
	completedDate: null,
	dnfPage: null,
	dnfPercent: null,
	dnfReason: null,
	dnfDate: null,
	readingProgress: null,
	lastReadAt: null,
	purchasePrice: null
};

/**
 * Left join of the viewer's user_books row onto books, and the personal columns read from it.
 * Use as `.leftJoin(p.table, p.on)` and spread `p.cols` into the select. readingProgress is the
 * book-shaped JSON position (user_books.readingPosition). purchasePrice was never moved: the
 * row's value is blanked at boot (book_media_sources holds prices) and showed only to the owner.
 */
export function personalCols(userId: number | null | undefined, bookId: SQL | typeof books.id = books.id) {
	const uid = userId ?? NO_VIEWER;
	return {
		table: viewerBooks,
		on: and(eq(viewerBooks.bookId, bookId), eq(viewerBooks.userId, uid))!,
		cols: {
			statusId: viewerBooks.statusId,
			rating: viewerBooks.rating,
			comments: viewerBooks.comments,
			startReadingDate: viewerBooks.startReadingDate,
			completedDate: viewerBooks.completedDate,
			dnfPage: viewerBooks.dnfPage,
			dnfPercent: viewerBooks.dnfPercent,
			dnfReason: viewerBooks.dnfReason,
			dnfDate: viewerBooks.dnfDate,
			readingProgress: viewerBooks.readingPosition,
			lastReadAt: viewerBooks.lastReadAt,
			purchasePrice: sql<number | null>`CASE WHEN ${books.ownerId} = ${uid} THEN ${books.purchasePrice} END`
		}
	};
}

/**
 * The same join for raw SQL: `LEFT JOIN user_books vub ON vub.bookId = <alias>.id AND vub.userId = ?`.
 * Reference the fields as vub.rating, vub.statusId, ... Always table-qualify the book side too.
 */
export function personalJoinSql(userId: number | null | undefined, bookAlias = 'b', ubAlias = 'vub'): SQL {
	return sql`LEFT JOIN user_books ${sql.raw(ubAlias)} ON ${sql.raw(ubAlias)}.bookId = ${sql.raw(bookAlias)}.id AND ${sql.raw(ubAlias)}.userId = ${userId ?? NO_VIEWER}`;
}

/** user_books.readingProgress is a REAL percent, but an old backfill stored row JSON in it */
export function progressPercent(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
		try {
			const parsed = JSON.parse(value) as { percentage?: unknown };
			const pct = Number(parsed?.percentage);
			return Number.isFinite(pct) ? pct : 0;
		} catch {
			return 0;
		}
	}
	return 0;
}

type UserBookRow = typeof userBooks.$inferSelect;

function personalFrom(ub: UserBookRow | undefined, book: { ownerId?: number | null; purchasePrice?: number | null }, userId: number | null | undefined): PersonalFields {
	const purchasePrice = userId != null && book.ownerId === userId ? (book.purchasePrice ?? null) : null;
	if (!ub) return { ...EMPTY_PERSONAL, purchasePrice };
	return {
		statusId: ub.statusId,
		rating: ub.rating,
		comments: ub.comments,
		startReadingDate: ub.startReadingDate,
		completedDate: ub.completedDate,
		dnfPage: ub.dnfPage,
		dnfPercent: ub.dnfPercent,
		dnfReason: ub.dnfReason,
		dnfDate: ub.dnfDate,
		readingProgress: ub.readingPosition,
		lastReadAt: ub.lastReadAt,
		purchasePrice
	};
}

/**
 * Replace the personal fields of full books rows with the viewer's own (for `select().from(books)`
 * call sites). Books without a row for the viewer come back with every personal field null.
 */
export async function overlayPersonal<T extends { id: number }>(rows: T[], userId: number | null | undefined): Promise<(T & PersonalFields)[]> {
	if (rows.length === 0) return [];
	const own = userId == null
		? []
		: await db.select().from(userBooks).where(and(eq(userBooks.userId, userId), inArray(userBooks.bookId, rows.map((r) => r.id))));
	const byBook = new Map(own.map((ub) => [ub.bookId, ub]));
	return rows.map((row) => ({ ...row, ...personalFrom(byBook.get(row.id), row as { ownerId?: number | null; purchasePrice?: number | null }, userId) }));
}

/** The viewer's personal fields for one book */
export async function getPersonal(userId: number | null | undefined, book: { id: number; ownerId?: number | null; purchasePrice?: number | null }): Promise<PersonalFields> {
	if (userId == null) return personalFrom(undefined, book, userId);
	const [ub] = await db.select().from(userBooks).where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, book.id))).limit(1);
	return personalFrom(ub, book, userId);
}

// ============================================
// Writes: always the acting user's own row
// ============================================

export interface PersonalWrite {
	rating?: number | null;
	comments?: string | null;
	startReadingDate?: string | null;
	completedDate?: string | null;
	dnfPage?: number | null;
	dnfPercent?: number | null;
	dnfReason?: string | null;
	dnfDate?: string | null;
	readingProgress?: number | null;
	readingPosition?: string | null;
	lastReadAt?: string | null;
}

/** Book-body keys that are personal state (statusId goes through applyStatusChange) */
export const PERSONAL_WRITE_KEYS = ['rating', 'comments', 'startReadingDate', 'completedDate', 'dnfPage', 'dnfPercent', 'dnfReason', 'dnfDate'] as const;

/**
 * Split a book create/update body into catalog fields and personal fields. statusId comes out on
 * its own; readingProgress / lastReadAt never pass through a book body. purchasePrice is dropped:
 * the books row no longer holds it (book_media_sources is the price home).
 */
export function splitPersonal<T extends Record<string, unknown>>(data: T): {
	catalog: Omit<T, (typeof PERSONAL_WRITE_KEYS)[number] | 'statusId' | 'readingProgress' | 'lastReadAt' | 'purchasePrice'>;
	personal: PersonalWrite;
	statusId: number | null | undefined;
} {
	const catalog: Record<string, unknown> = { ...data };
	const personal: Record<string, unknown> = {};
	for (const key of PERSONAL_WRITE_KEYS) {
		if (key in catalog) {
			if (catalog[key] !== undefined) personal[key] = catalog[key];
			delete catalog[key];
		}
	}
	const statusId = catalog.statusId as number | null | undefined;
	delete catalog.statusId;
	delete catalog.purchasePrice;
	delete catalog.readingProgress;
	delete catalog.lastReadAt;
	return { catalog: catalog as never, personal: personal as PersonalWrite, statusId };
}

const STATUS_EXISTS = (statusId: number | null | undefined) =>
	statusId == null ? Promise.resolve(true) : db.select({ id: statuses.id }).from(statuses).where(eq(statuses.id, statusId)).limit(1).then((r) => r.length > 0);

/**
 * Write personal fields to the user's own row for a book, creating the row when missing (which
 * also puts the book in their library). Undefined fields are left alone. Returns the row id.
 */
export async function writePersonal(userId: number, bookId: number, data: PersonalWrite & { statusId?: number | null }): Promise<number> {
	const now = new Date().toISOString();
	const set: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) if (value !== undefined) set[key] = value;
	if ('statusId' in set && !(await STATUS_EXISTS(set.statusId as number | null))) set.statusId = null;
	const [existing] = await db.select({ id: userBooks.id }).from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))).limit(1);
	if (existing) {
		if (Object.keys(set).length > 0) await db.update(userBooks).set({ ...set, updatedAt: now }).where(eq(userBooks.id, existing.id));
		return existing.id;
	}
	const [created] = await db.insert(userBooks)
		.values({ userId, bookId, ...set, addedAt: now, createdAt: now, updatedAt: now })
		.returning({ id: userBooks.id });
	return created.id;
}

/** True when the body carries any personal field */
export function hasPersonal(personal: PersonalWrite): boolean {
	return Object.values(personal).some((v) => v !== undefined);
}


/**
 * Save a reader position (the JSON the web reader and KOReader write) on the user's own row, with
 * the percent and last-read time. Reading never adds a book to a library: without a row nothing is
 * saved (the reader Adds first), except for the book's owner, whose missing row is put back.
 * Returns false when nothing was saved.
 */
export async function writeOwnPosition(userId: number, bookId: number, position: string, percent: number, at: string): Promise<boolean> {
	const [existing] = await db.select({ id: userBooks.id }).from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))).limit(1);
	if (existing) {
		await db.update(userBooks)
			.set({ readingPosition: position, readingProgress: percent, lastReadAt: at, updatedAt: at })
			.where(eq(userBooks.id, existing.id));
		return true;
	}
	if (!(await holdsBook(userId, bookId))) return false;
	await db.insert(userBooks).values({
		userId,
		bookId,
		readingPosition: position,
		readingProgress: percent,
		lastReadAt: at,
		addedAt: at,
		createdAt: at,
		updatedAt: at
	});
	return true;
}

/** The user's own reader position and last-read time for a book */
export async function getOwnPosition(userId: number, bookId: number): Promise<{ position: string | null; lastReadAt: string | null; percent: number }> {
	const [row] = await db.select({ position: userBooks.readingPosition, lastReadAt: userBooks.lastReadAt, percent: userBooks.readingProgress })
		.from(userBooks).where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))).limit(1);
	return { position: row?.position ?? null, lastReadAt: row?.lastReadAt ?? null, percent: progressPercent(row?.percent) };
}
