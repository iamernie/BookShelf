/**
 * Reading Session Service
 *
 * Tracks reading sessions for heatmap visualization.
 * Sessions are started when a user opens a book in the reader and ended when they close it.
 */

import { db } from '$lib/server/db';
import { readingSessions, books } from '$lib/server/db/schema';
import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm';

export interface ReadingSessionData {
	id: number;
	bookId: number;
	userId: number | null;
	startedAt: string;
	endedAt: string | null;
	durationMinutes: number | null;
	pagesRead: number | null;
	startProgress: number | null;
	endProgress: number | null;
}

export interface DayActivity {
	date: string; // YYYY-MM-DD
	totalMinutes: number;
	sessionCount: number;
	booksRead: number[];
}

export interface HeatmapData {
	days: DayActivity[];
	totalMinutes: number;
	totalSessions: number;
	longestStreak: number;
	currentStreak: number;
}

/**
 * Start a new reading session
 */
export async function startSession(
	bookId: number,
	userId?: number,
	startProgress?: number
): Promise<number> {
	// End any existing active sessions for this book/user
	await endActiveSession(bookId, userId);

	const [result] = await db
		.insert(readingSessions)
		.values({
			bookId,
			userId: userId ?? null,
			startedAt: new Date().toISOString(),
			startProgress: startProgress ?? null
		})
		.returning({ id: readingSessions.id });

	return result.id;
}

/**
 * End an active reading session
 */
export async function endSession(
	sessionId: number,
	endProgress?: number,
	pagesRead?: number
): Promise<void> {
	const now = new Date();
	const [session] = await db
		.select()
		.from(readingSessions)
		.where(eq(readingSessions.id, sessionId))
		.limit(1);

	if (!session || session.endedAt) return;

	const startedAt = new Date(session.startedAt);
	const durationMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);

	await db
		.update(readingSessions)
		.set({
			endedAt: now.toISOString(),
			durationMinutes,
			endProgress: endProgress ?? null,
			pagesRead: pagesRead ?? null
		})
		.where(eq(readingSessions.id, sessionId));
}

/**
 * End any active (non-ended) session for a book/user
 */
export async function endActiveSession(bookId: number, userId?: number): Promise<void> {
	const conditions = [eq(readingSessions.bookId, bookId), isNull(readingSessions.endedAt)];

	if (userId) {
		conditions.push(eq(readingSessions.userId, userId));
	}

	const activeSessions = await db
		.select()
		.from(readingSessions)
		.where(and(...conditions));

	for (const session of activeSessions) {
		await endSession(session.id);
	}
}

/**
 * Get the active session for a book/user (if any)
 */
export async function getActiveSession(
	bookId: number,
	userId?: number
): Promise<ReadingSessionData | null> {
	const conditions = [eq(readingSessions.bookId, bookId), isNull(readingSessions.endedAt)];

	if (userId) {
		conditions.push(eq(readingSessions.userId, userId));
	}

	const [session] = await db
		.select()
		.from(readingSessions)
		.where(and(...conditions))
		.limit(1);

	return session || null;
}

/**
 * Get heatmap data for a year
 */
export async function getHeatmapData(year: number, userId?: number): Promise<HeatmapData> {
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31`;

	const conditions = [
		gte(readingSessions.startedAt, startDate),
		lte(readingSessions.startedAt, endDate + 'T23:59:59')
	];

	if (userId) {
		conditions.push(eq(readingSessions.userId, userId));
	}

	// Get all sessions for the year
	const sessions = await db
		.select({
			id: readingSessions.id,
			bookId: readingSessions.bookId,
			startedAt: readingSessions.startedAt,
			durationMinutes: readingSessions.durationMinutes
		})
		.from(readingSessions)
		.where(and(...conditions))
		.orderBy(readingSessions.startedAt);

	// Aggregate by day
	const dayMap = new Map<string, DayActivity>();

	for (const session of sessions) {
		const date = session.startedAt.split('T')[0];
		const existing = dayMap.get(date) || {
			date,
			totalMinutes: 0,
			sessionCount: 0,
			booksRead: []
		};

		existing.totalMinutes += session.durationMinutes || 0;
		existing.sessionCount++;
		if (!existing.booksRead.includes(session.bookId)) {
			existing.booksRead.push(session.bookId);
		}

		dayMap.set(date, existing);
	}

	const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

	// Calculate streaks
	const { longestStreak, currentStreak } = calculateStreaks(days);

	const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0);
	const totalSessions = days.reduce((sum, d) => sum + d.sessionCount, 0);

	return {
		days,
		totalMinutes,
		totalSessions,
		longestStreak,
		currentStreak
	};
}

/**
 * Calculate reading streaks from day data
 */
function calculateStreaks(days: DayActivity[]): { longestStreak: number; currentStreak: number } {
	if (days.length === 0) {
		return { longestStreak: 0, currentStreak: 0 };
	}

	// Create a set of dates that have reading activity
	const readingDates = new Set(days.map((d) => d.date));

	let longestStreak = 0;
	let currentStreak = 0;

	// Check if today or yesterday has activity (for current streak)
	const today = new Date().toISOString().split('T')[0];
	const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

	// Calculate longest streak
	let streak = 0;
	let lastDate: Date | null = null;

	for (const day of days) {
		const date = new Date(day.date);

		if (lastDate) {
			const diffDays = Math.round((date.getTime() - lastDate.getTime()) / 86400000);
			if (diffDays === 1) {
				streak++;
			} else {
				streak = 1;
			}
		} else {
			streak = 1;
		}

		longestStreak = Math.max(longestStreak, streak);
		lastDate = date;
	}

	// Calculate current streak (must include today or yesterday)
	if (readingDates.has(today) || readingDates.has(yesterday)) {
		currentStreak = 1;
		let checkDate = readingDates.has(today) ? today : yesterday;

		while (true) {
			const prevDate = new Date(new Date(checkDate).getTime() - 86400000)
				.toISOString()
				.split('T')[0];
			if (readingDates.has(prevDate)) {
				currentStreak++;
				checkDate = prevDate;
			} else {
				break;
			}
		}
	}

	return { longestStreak, currentStreak };
}

/**
 * Get recent reading sessions with book info
 */
export async function getRecentSessions(
	limit: number = 10,
	userId?: number
): Promise<
	Array<{
		session: ReadingSessionData;
		book: { id: number; title: string; coverImageUrl: string | null };
	}>
> {
	const conditions = [];
	if (userId) {
		conditions.push(eq(readingSessions.userId, userId));
	}

	const query = db
		.select({
			session: readingSessions,
			book: {
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl
			}
		})
		.from(readingSessions)
		.innerJoin(books, eq(readingSessions.bookId, books.id))
		.orderBy(desc(readingSessions.startedAt))
		.limit(limit);

	if (conditions.length > 0) {
		return query.where(and(...conditions));
	}

	return query;
}

/**
 * Get reading stats for a specific time period
 */
export async function getReadingStats(
	startDate: string,
	endDate: string,
	userId?: number
): Promise<{
	totalMinutes: number;
	totalSessions: number;
	uniqueBooks: number;
	avgSessionMinutes: number;
}> {
	const conditions = [
		gte(readingSessions.startedAt, startDate),
		lte(readingSessions.startedAt, endDate + 'T23:59:59')
	];

	if (userId) {
		conditions.push(eq(readingSessions.userId, userId));
	}

	const sessions = await db
		.select({
			durationMinutes: readingSessions.durationMinutes,
			bookId: readingSessions.bookId
		})
		.from(readingSessions)
		.where(and(...conditions));

	const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
	const uniqueBooks = new Set(sessions.map((s) => s.bookId)).size;
	const avgSessionMinutes = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;

	return {
		totalMinutes,
		totalSessions: sessions.length,
		uniqueBooks,
		avgSessionMinutes
	};
}

/**
 * Delete old sessions (for cleanup)
 */
export async function cleanupOldSessions(daysToKeep: number = 365): Promise<number> {
	const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString();

	const result = await db
		.delete(readingSessions)
		.where(lte(readingSessions.startedAt, cutoffDate))
		.returning({ id: readingSessions.id });

	return result.length;
}
