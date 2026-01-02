/**
 * Debug endpoint to diagnose chart data issues
 * GET /api/admin/debug-chart - Returns diagnostic info about chart data
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books, userBooks, statuses } from '$lib/server/db';
import { eq, sql, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	// Admin-only access
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const userId = locals.user.id;
	const currentYear = new Date().getFullYear();
	const yearPattern = `${currentYear}%`;

	// Get READ status ID
	const readStatus = await db.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, 'READ'))
		.limit(1);

	const readStatusId = readStatus[0]?.id;

	if (!readStatusId) {
		return json({ error: 'READ status not found', readStatusId: null });
	}

	// Query 1: Count from user_books (what getMonthlyReadingData uses)
	const userBooksQuery = await db.select({
		count: sql<number>`count(*)`
	})
		.from(userBooks)
		.where(and(
			eq(userBooks.userId, userId),
			eq(userBooks.statusId, readStatusId),
			sql`${userBooks.completedDate} LIKE ${yearPattern}`
		));

	// Query 2: Count from books table with library condition (what getStatsOverview uses)
	const libCond = sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`;
	const booksQuery = await db.select({
		count: sql<number>`count(*)`
	})
		.from(books)
		.where(and(
			eq(books.statusId, readStatusId),
			sql`${books.completedDate} LIKE ${yearPattern}`,
			libCond
		));

	// Query 3: Sample completedDate formats from user_books
	const sampleUserBooks = await db.select({
		bookId: userBooks.bookId,
		completedDate: userBooks.completedDate
	})
		.from(userBooks)
		.where(and(
			eq(userBooks.userId, userId),
			eq(userBooks.statusId, readStatusId)
		))
		.limit(5);

	// Query 4: Sample completedDate formats from books
	const sampleBooks = await db.select({
		id: books.id,
		completedDate: books.completedDate
	})
		.from(books)
		.where(and(
			eq(books.statusId, readStatusId),
			libCond
		))
		.limit(5);

	// Query 5: Monthly breakdown from user_books
	const monthlyFromUserBooks = await db.select({
		month: sql<string>`strftime('%m', ${userBooks.completedDate})`,
		count: sql<number>`count(*)`
	})
		.from(userBooks)
		.where(and(
			eq(userBooks.userId, userId),
			eq(userBooks.statusId, readStatusId),
			sql`${userBooks.completedDate} LIKE ${yearPattern}`
		))
		.groupBy(sql`strftime('%m', ${userBooks.completedDate})`);

	return json({
		userId,
		readStatusId,
		currentYear,
		yearPattern,
		counts: {
			fromUserBooks: userBooksQuery[0]?.count ?? 0,
			fromBooksTable: booksQuery[0]?.count ?? 0
		},
		samples: {
			userBooks: sampleUserBooks,
			books: sampleBooks
		},
		monthlyFromUserBooks
	});
};
