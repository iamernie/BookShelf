import { db, statuses, books, users, userBooks } from '$lib/server/db';
import { eq, asc, sql, and, inArray } from 'drizzle-orm';
import { todayInAppTz } from '$lib/server/utils/appTime';
import { notifyBookCompleted, checkAndNotifySeriesCompletion } from './notificationService';

// Infer Status type from schema
type StatusType = typeof statuses.$inferSelect;

export interface StatusWithCount extends StatusType {
	bookCount: number;
}

export async function getStatuses(): Promise<StatusWithCount[]> {
	// Get all statuses
	const statusList = await db
		.select()
		.from(statuses)
		.orderBy(asc(statuses.sortOrder), asc(statuses.name));

	// Get book counts for each status
	const items = await Promise.all(
		statusList.map(async (status) => {
			const countResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(books)
				.where(eq(books.statusId, status.id));

			return {
				...status,
				bookCount: countResult[0]?.count ?? 0
			};
		})
	);

	return items;
}

export async function getStatusById(id: number): Promise<StatusWithCount | null> {
	const status = await db.select().from(statuses).where(eq(statuses.id, id)).limit(1);
	if (!status[0]) return null;

	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.statusId, id));

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

// Get books with a specific status
export async function getBooksByStatus(statusId: number): Promise<{ id: number; title: string; coverImageUrl: string | null }[]> {
	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
		.from(books)
		.where(eq(books.statusId, statusId))
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
// Status changes: the one place a book's status moves
// ============================================

export type StatusChangeSource = 'book_edit' | 'bulk' | 'abs_sync' | 'api_v1';

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
	 * Only move the acting user's own reading record (user_books), never books.statusId.
	 * For books the user doesn't own (public books in their library); requires userId.
	 */
	userBooksOnly?: boolean;
}

export interface ApplyStatusChangeResult {
	changed: number[];
	unchanged: number[];
	userBooksUpdated: number;
	userBooksSkipped: number[];
}

const isEmptyDate = (value: string | null | undefined): boolean => value == null || value === '';

/**
 * Move books to a status. Books already in that status are left alone. Stamps
 * startReadingDate on Current and completedDate on Done (only when empty; explicit
 * dates win), writes books, mirrors the result onto the user's existing user_books row
 * (never creates one), and notifies on completion with series checked once per series.
 */
export async function applyStatusChange(
	bookIds: number[],
	statusId: number | null,
	opts: ApplyStatusChangeOptions
): Promise<ApplyStatusChangeResult> {
	const result: ApplyStatusChangeResult = { changed: [], unchanged: [], userBooksUpdated: 0, userBooksSkipped: [] };
	const ids = [...new Set(bookIds.filter((id) => Number.isInteger(id)))];
	if (ids.length === 0) return result;

	const [currentStatus, readStatus] = await Promise.all([getStatusByKey('CURRENT'), getStatusByKey('READ')]);
	const isCurrent = statusId !== null && statusId === currentStatus?.id;
	const isRead = statusId !== null && statusId === readStatus?.id;

	if (opts.userBooksOnly) {
		if (opts.userId == null) throw new Error('applyStatusChange: userBooksOnly needs a userId');
		return applyUserBookStatusChange(ids, statusId, opts.userId, { isCurrent, isRead }, opts, result);
	}

	const rows = await db
		.select({
			id: books.id,
			title: books.title,
			ownerId: books.ownerId,
			statusId: books.statusId,
			startReadingDate: books.startReadingDate,
			completedDate: books.completedDate
		})
		.from(books)
		.where(inArray(books.id, ids));

	const today = todayInAppTz();
	const explicit = opts.dates ?? {};
	let fallbackOwnerId: number | null | undefined;
	const completions: { userId: number; id: number; title: string; completedDate: string | null }[] = [];

	for (const row of rows) {
		if (row.statusId === statusId) {
			result.unchanged.push(row.id);
			continue;
		}

		let startReadingDate = row.startReadingDate;
		if (explicit.startReadingDate !== undefined) {
			startReadingDate = explicit.startReadingDate;
		} else if (isCurrent && isEmptyDate(startReadingDate)) {
			startReadingDate = opts.stampDates?.startReadingDate ?? today;
		} else if (isRead && isEmptyDate(startReadingDate) && opts.stampDates?.startReadingDate) {
			startReadingDate = opts.stampDates.startReadingDate;
		}

		let completedDate = row.completedDate;
		if (explicit.completedDate !== undefined) {
			completedDate = explicit.completedDate;
		} else if (isRead && isEmptyDate(completedDate)) {
			completedDate = opts.stampDates?.completedDate ?? today;
		}

		const now = new Date().toISOString();
		await db
			.update(books)
			.set({ statusId, startReadingDate, completedDate, updatedAt: now })
			.where(eq(books.id, row.id));
		result.changed.push(row.id);

		let userId = opts.userId ?? row.ownerId ?? null;
		if (userId === null) {
			if (fallbackOwnerId === undefined) fallbackOwnerId = await getDefaultOwnerId();
			userId = fallbackOwnerId;
		}

		// Mirror onto the user's reading record; a missing row means not in their library
		const [userBook] = userId === null ? [] : await db
			.select({ id: userBooks.id })
			.from(userBooks)
			.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, row.id)))
			.limit(1);
		if (userBook) {
			await db
				.update(userBooks)
				.set({ statusId, startReadingDate, completedDate, updatedAt: now })
				.where(eq(userBooks.id, userBook.id));
			result.userBooksUpdated++;
		} else {
			result.userBooksSkipped.push(row.id);
		}

		if (isRead && userId !== null) completions.push({ userId, id: row.id, title: row.title, completedDate });
	}

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

// The userBooksOnly branch of applyStatusChange: same stamping rules, on the user's own row only
async function applyUserBookStatusChange(
	ids: number[],
	statusId: number | null,
	userId: number,
	kind: { isCurrent: boolean; isRead: boolean },
	opts: ApplyStatusChangeOptions,
	result: ApplyStatusChangeResult
): Promise<ApplyStatusChangeResult> {
	const rows = await db
		.select({
			id: userBooks.id,
			bookId: userBooks.bookId,
			title: books.title,
			statusId: userBooks.statusId,
			startReadingDate: userBooks.startReadingDate,
			completedDate: userBooks.completedDate
		})
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(and(eq(userBooks.userId, userId), inArray(userBooks.bookId, ids)));

	const today = todayInAppTz();
	const explicit = opts.dates ?? {};
	const completions: { id: number; title: string; completedDate: string | null }[] = [];
	const found = new Set(rows.map((r) => r.bookId));
	for (const id of ids) if (!found.has(id)) result.userBooksSkipped.push(id);

	for (const row of rows) {
		if (row.statusId === statusId) {
			result.unchanged.push(row.bookId);
			continue;
		}

		let startReadingDate = row.startReadingDate;
		if (explicit.startReadingDate !== undefined) startReadingDate = explicit.startReadingDate;
		else if (kind.isCurrent && isEmptyDate(startReadingDate)) startReadingDate = opts.stampDates?.startReadingDate ?? today;
		else if (kind.isRead && isEmptyDate(startReadingDate) && opts.stampDates?.startReadingDate) startReadingDate = opts.stampDates.startReadingDate;

		let completedDate = row.completedDate;
		if (explicit.completedDate !== undefined) completedDate = explicit.completedDate;
		else if (kind.isRead && isEmptyDate(completedDate)) completedDate = opts.stampDates?.completedDate ?? today;

		await db
			.update(userBooks)
			.set({ statusId, startReadingDate, completedDate, updatedAt: new Date().toISOString() })
			.where(eq(userBooks.id, row.id));
		result.changed.push(row.bookId);
		result.userBooksUpdated++;
		if (kind.isRead) completions.push({ id: row.bookId, title: row.title, completedDate });
	}

	if (opts.notify !== false && completions.length > 0) {
		const toNotify = opts.source === 'abs_sync' ? completions.filter((c) => c.completedDate === today) : completions;
		for (const c of toNotify) {
			notifyBookCompleted(userId, { id: c.id, title: c.title })
				.catch(err => console.error('[notifications] Failed to send book completed notification:', err));
		}
		if (toNotify.length > 0) {
			checkAndNotifySeriesCompletion(userId, toNotify.map((c) => c.id))
				.catch(err => console.error('[notifications] Failed to check series completion:', err));
		}
	}

	return result;
}
