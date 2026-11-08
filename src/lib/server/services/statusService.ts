import { db, statuses, books, users, userBooks, series, seriesStatuses, bookSeries } from '$lib/server/db';
import { eq, asc, sql, and, inArray } from 'drizzle-orm';
import { todayInAppTz } from '$lib/server/utils/appTime';
import { notifyBookCompleted, checkAndNotifySeriesCompletion } from './notificationService';

// Infer Status type from schema
type StatusType = typeof statuses.$inferSelect;

export interface StatusWithCount extends StatusType {
	bookCount: number;
}

/** Status list with the viewer's own book counts (user_books); no viewer counts nothing */
export async function getStatuses(userId?: number | null): Promise<StatusWithCount[]> {
	const statusList = await db
		.select()
		.from(statuses)
		.orderBy(asc(statuses.sortOrder), asc(statuses.name));

	const counts = userId == null ? [] : await db
		.select({ statusId: userBooks.statusId, count: sql<number>`count(*)` })
		.from(userBooks)
		.where(eq(userBooks.userId, userId))
		.groupBy(userBooks.statusId);
	const byStatus = new Map(counts.map((c) => [c.statusId, c.count]));

	return statusList.map((status) => ({ ...status, bookCount: byStatus.get(status.id) ?? 0 }));
}

export async function getStatusById(id: number, userId?: number | null): Promise<StatusWithCount | null> {
	const status = await db.select().from(statuses).where(eq(statuses.id, id)).limit(1);
	if (!status[0]) return null;

	const countResult = userId == null ? [] : await db
		.select({ count: sql<number>`count(*)` })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.statusId, id)));

	return {
		...status[0],
		bookCount: countResult[0]?.count ?? 0
	};
}

// Only allow updating the name (for localization) - statuses are system-defined
export async function updateStatusName(id: number, name: string): Promise<StatusType | null> {
	const now = new Date().toISOString();

	const [updated] = await db
		.update(statuses)
		.set({ name, updatedAt: now })
		.where(eq(statuses.id, id))
		.returning();

	return updated || null;
}

// The viewer's books with a specific status
export async function getBooksByStatus(statusId: number, userId?: number | null): Promise<{ id: number; title: string; coverImageUrl: string | null }[]> {
	if (userId == null) return [];
	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
		.from(books)
		.innerJoin(userBooks, and(eq(userBooks.bookId, books.id), eq(userBooks.userId, userId)))
		.where(eq(userBooks.statusId, statusId))
		.orderBy(asc(books.title));
}

// Get all statuses for dropdowns
export async function getAllStatuses(): Promise<{ id: number; name: string; color: string | null; icon: string | null }[]> {
	return db
		.select({
			id: statuses.id,
			name: statuses.name,
			color: statuses.color,
			icon: statuses.icon
		})
		.from(statuses)
		.orderBy(asc(statuses.sortOrder), asc(statuses.name));
}

// Get status by key (UNREAD, READ, CURRENT, NEXT, ON_HOLD, DNF)
export async function getStatusByKey(key: string): Promise<StatusType | null> {
	const [status] = await db
		.select()
		.from(statuses)
		.where(eq(statuses.key, key))
		.limit(1);
	return status || null;
}

// Owner for books with no ownerId (and for callers with no acting user): the first admin
export async function getDefaultOwnerId(): Promise<number | null> {
	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).orderBy(asc(users.id)).limit(1);
	return user?.id ?? null;
}

// ============================================
// Series status follows its books (2.27.3)
// ============================================

interface SeriesStatusIds {
	finishedId: number | null;
	ongoingId: number | null;
	parkedId: number | null;
	dnfId: number | null;
	settledIds: number[];
}

async function seriesStatusIds(): Promise<SeriesStatusIds> {
	const [seriesStatusRows, settledRows] = await Promise.all([
		db.select({ id: seriesStatuses.id, name: seriesStatuses.name, key: seriesStatuses.key }).from(seriesStatuses),
		db.select({ id: statuses.id }).from(statuses).where(inArray(statuses.key, ['READ', 'DNF']))
	]);
	const find = (word: string) =>
		seriesStatusRows.find((s) => s.key?.toUpperCase() === word.toUpperCase() || s.name.trim().toLowerCase() === word)?.id ?? null;
	return { finishedId: find('finished'), ongoingId: find('ongoing'), parkedId: find('parked'), dnfId: find('dnf'), settledIds: settledRows.map((s) => s.id) };
}

/**
 * Keep the stored series.statusId in step with its owned (personal library) books, read from
 * each owner's own user_books row: any unsettled book makes it Ongoing, all Done or DNF makes it
 * Finished. A series with no owned books, or one set to Parked or DNF by hand, is left alone; only
 * differing values are written. Statuses resolve by key or name, so a library without those rows
 * changes nothing. Returns the series it changed. Viewers see their own derivation via
 * getViewerSeriesStatuses; the stored value is what shows when they have no books in the series.
 */
export async function recomputeSeriesStatuses(seriesIds: number[]): Promise<number> {
	const ids = [...new Set(seriesIds.filter((id) => Number.isInteger(id)))];
	if (ids.length === 0) return 0;

	const { finishedId, ongoingId, parkedId, dnfId, settledIds } = await seriesStatusIds();
	if (finishedId === null || ongoingId === null) return 0;
	const settled = settledIds.length > 0
		? sql<number>`SUM(CASE WHEN ${inArray(userBooks.statusId, settledIds)} THEN 1 ELSE 0 END)`
		: sql<number>`0`;

	const rows = await db
		.select({ id: series.id, statusId: series.statusId, owned: sql<number>`COUNT(${books.id})`, settled })
		.from(series)
		.innerJoin(bookSeries, eq(bookSeries.seriesId, series.id))
		.innerJoin(books, and(eq(books.id, bookSeries.bookId), eq(books.libraryType, 'personal')))
		.leftJoin(userBooks, and(eq(userBooks.bookId, books.id), eq(userBooks.userId, books.ownerId)))
		.where(inArray(series.id, ids))
		.groupBy(series.id);

	let changed = 0;
	for (const row of rows) {
		if (row.owned === 0) continue;
		if (row.statusId !== null && (row.statusId === parkedId || row.statusId === dnfId)) continue;
		const target = Number(row.settled) >= row.owned ? finishedId : ongoingId;
		if (row.statusId === target) continue;
		await db.update(series).set({ statusId: target }).where(eq(series.id, row.id));
		changed++;
	}
	return changed;
}

/** recomputeSeriesStatuses for every series the books belong to; books with no series are skipped */
export async function recomputeSeriesStatusesForBooks(bookIds: number[]): Promise<number> {
	const ids = [...new Set(bookIds.filter((id) => Number.isInteger(id)))];
	if (ids.length === 0) return 0;
	const rows = await db.select({ seriesId: bookSeries.seriesId }).from(bookSeries).where(inArray(bookSeries.bookId, ids));
	return recomputeSeriesStatuses(rows.map((r) => r.seriesId));
}

/**
 * Series status as one viewer sees it (owner decision: per viewer). Parked and DNF set by hand
 * show as stored; otherwise a series with any of the viewer's library books in it is Finished
 * when all of them are Done or DNF in the viewer's own row, else Ongoing. A series the viewer
 * has no books in shows its stored status. Returns seriesId -> statusId for every id asked.
 */
export async function getViewerSeriesStatuses(seriesIds: number[], userId: number | null | undefined): Promise<Map<number, number | null>> {
	const ids = [...new Set(seriesIds.filter((id) => Number.isInteger(id)))];
	const out = new Map<number, number | null>();
	if (ids.length === 0) return out;
	const stored = await db.select({ id: series.id, statusId: series.statusId }).from(series).where(inArray(series.id, ids));
	for (const row of stored) out.set(row.id, row.statusId);
	if (userId == null) return out;

	const { finishedId, ongoingId, parkedId, dnfId, settledIds } = await seriesStatusIds();
	if (finishedId === null || ongoingId === null) return out;
	const settled = settledIds.length > 0
		? sql<number>`SUM(CASE WHEN ${inArray(userBooks.statusId, settledIds)} THEN 1 ELSE 0 END)`
		: sql<number>`0`;
	const rows = await db
		.select({ id: bookSeries.seriesId, mine: sql<number>`COUNT(${userBooks.id})`, settled })
		.from(bookSeries)
		.innerJoin(userBooks, and(eq(userBooks.bookId, bookSeries.bookId), eq(userBooks.userId, userId)))
		.where(inArray(bookSeries.seriesId, ids))
		.groupBy(bookSeries.seriesId);
	for (const row of rows) {
		const current = out.get(row.id) ?? null;
		if (row.mine === 0) continue;
		if (current !== null && (current === parkedId || current === dnfId)) continue;
		out.set(row.id, Number(row.settled) >= row.mine ? finishedId : ongoingId);
	}
	return out;
}

// ============================================
// Status changes: the one place a book's status moves
// ============================================

export type StatusChangeSource = 'book_edit' | 'bulk' | 'abs_sync' | 'api_v1' | 'series_suggestion';

export interface ApplyStatusChangeOptions {
	source: StatusChangeSource;
	/** Acting user; when null, resolved per book via books.ownerId, falling back to the first admin */
	userId?: number | null;
	/** Explicit dates: written as given, never stamped over */
	dates?: { startReadingDate?: string | null; completedDate?: string | null };
	/** Dates stamped instead of today (ABS timestamps) */
	stampDates?: { startReadingDate?: string; completedDate?: string };
	/** Send completion notifications (default true) */
	notify?: boolean;
	/**
	 * Kept for callers from before 2.30.0: every status change now moves only the acting user's
	 * own reading record (user_books), so this only insists on a userId.
	 */
	userBooksOnly?: boolean;
}

export interface ApplyStatusChangeResult {
	changed: number[];
	unchanged: number[];
	userBooksUpdated: number;
	/** user_books rows created because the user had none for the book */
	userBooksCreated: number;
	/** Always empty since 2.30.0 (a missing row is created); kept for the result shape */
	userBooksSkipped: number[];
}

const isEmptyDate = (value: string | null | undefined): boolean => value == null || value === '';

/**
 * Move books to a status on the acting user's own reading record (user_books), creating the row
 * when the user has none. Books already in that status for the user are left alone. Stamps
 * startReadingDate on Current and completedDate on Done (only when empty; explicit dates win),
 * recomputes the series statuses and notifies on completion with series checked once per user.
 * books.statusId is never written.
 */
export async function applyStatusChange(
	bookIds: number[],
	statusId: number | null,
	opts: ApplyStatusChangeOptions
): Promise<ApplyStatusChangeResult> {
	const result: ApplyStatusChangeResult = { changed: [], unchanged: [], userBooksUpdated: 0, userBooksCreated: 0, userBooksSkipped: [] };
	const ids = [...new Set(bookIds.filter((id) => Number.isInteger(id)))];
	if (ids.length === 0) return result;
	if (opts.userBooksOnly && opts.userId == null) throw new Error('applyStatusChange: userBooksOnly needs a userId');

	const [currentStatus, readStatus] = await Promise.all([getStatusByKey('CURRENT'), getStatusByKey('READ')]);
	const isCurrent = statusId !== null && statusId === currentStatus?.id;
	const isRead = statusId !== null && statusId === readStatus?.id;

	const bookRows = await db
		.select({ id: books.id, title: books.title, ownerId: books.ownerId })
		.from(books)
		.where(inArray(books.id, ids));

	const today = todayInAppTz();
	const explicit = opts.dates ?? {};
	let fallbackOwnerId: number | null | undefined;
	const completions: { userId: number; id: number; title: string; completedDate: string | null }[] = [];

	for (const book of bookRows) {
		let userId = opts.userId ?? book.ownerId ?? null;
		if (userId === null) {
			if (fallbackOwnerId === undefined) fallbackOwnerId = await getDefaultOwnerId();
			userId = fallbackOwnerId;
		}
		if (userId === null) {
			// No acting user and no admin to fall back on: nobody's record to move
			result.unchanged.push(book.id);
			continue;
		}

		const [row] = await db
			.select({ id: userBooks.id, statusId: userBooks.statusId, startReadingDate: userBooks.startReadingDate, completedDate: userBooks.completedDate })
			.from(userBooks)
			.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, book.id)))
			.limit(1);

		if ((row?.statusId ?? null) === statusId) {
			result.unchanged.push(book.id);
			continue;
		}

		let startReadingDate = row?.startReadingDate ?? null;
		if (explicit.startReadingDate !== undefined) {
			startReadingDate = explicit.startReadingDate;
		} else if (isCurrent && isEmptyDate(startReadingDate)) {
			startReadingDate = opts.stampDates?.startReadingDate ?? today;
		} else if (isRead && isEmptyDate(startReadingDate) && opts.stampDates?.startReadingDate) {
			startReadingDate = opts.stampDates.startReadingDate;
		}

		let completedDate = row?.completedDate ?? null;
		if (explicit.completedDate !== undefined) {
			completedDate = explicit.completedDate;
		} else if (isRead && isEmptyDate(completedDate)) {
			completedDate = opts.stampDates?.completedDate ?? today;
		}

		const now = new Date().toISOString();
		if (row) {
			await db
				.update(userBooks)
				.set({ statusId, startReadingDate, completedDate, updatedAt: now })
				.where(eq(userBooks.id, row.id));
			result.userBooksUpdated++;
		} else {
			await db.insert(userBooks).values({
				userId,
				bookId: book.id,
				statusId,
				startReadingDate,
				completedDate,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			});
			result.userBooksCreated++;
		}
		result.changed.push(book.id);

		if (isRead) completions.push({ userId, id: book.id, title: book.title, completedDate });
	}

	if (result.changed.length > 0) await recomputeSeriesStatusesForBooks(result.changed);

	if (opts.notify !== false && completions.length > 0) {
		// ABS backfills old finishes; only a finish dated today is news
		const toNotify = opts.source === 'abs_sync'
			? completions.filter((c) => c.completedDate === today)
			: completions;

		const seriesBooksByUser = new Map<number, number[]>();
		for (const c of toNotify) {
			notifyBookCompleted(c.userId, { id: c.id, title: c.title })
				.catch(err => console.error('[notifications] Failed to send book completed notification:', err));
			seriesBooksByUser.set(c.userId, [...(seriesBooksByUser.get(c.userId) ?? []), c.id]);
		}
		for (const [userId, completedIds] of seriesBooksByUser) {
			checkAndNotifySeriesCompletion(userId, completedIds)
				.catch(err => console.error('[notifications] Failed to check series completion:', err));
		}
	}

	return result;
}
