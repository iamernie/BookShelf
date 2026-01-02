/**
 * Widget Service
 * Public embeddable widgets for displaying reading data on external sites
 */

import { db } from '$lib/server/db';
import { books, authors, series, bookAuthors, readingGoals, settings } from '$lib/server/db/schema';
import { eq, sql, desc, and, isNotNull } from 'drizzle-orm';
import crypto from 'crypto';
import { createLogger } from './loggerService';

const log = createLogger('widgets');

// Widget types
export type WidgetType = 'currently-reading' | 'recent-reads' | 'stats' | 'goal';
export type WidgetTheme = 'light' | 'dark';

export interface WidgetBook {
	id: number;
	title: string;
	coverUrl: string | null;
	author: string | null;
	series: string | null;
	bookNum: number | null;
	rating: number | null;
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

// Status IDs (matching the default statuses)
const STATUS_CURRENT = 2; // "Currently Reading"
const STATUS_READ = 1; // "Read"

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
 * Validate widget token
 */
export async function validateWidgetToken(token: string): Promise<boolean> {
	if (!token) return false;

	const storedToken = await getWidgetToken();
	return token === storedToken;
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
 * Check if widgets are enabled
 */
export async function areWidgetsEnabled(): Promise<boolean> {
	const result = await db
		.select()
		.from(settings)
		.where(eq(settings.key, 'widgets_enabled'))
		.limit(1);

	return result[0]?.value !== 'false';
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

/**
 * Get currently reading books for widget
 */
export async function getCurrentlyReading(limit: number = 5): Promise<WidgetBook[]> {
	const result = await db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			bookNum: books.bookNum,
			rating: books.rating,
			authorName: authors.name,
			seriesTitle: series.title
		})
		.from(books)
		.leftJoin(authors, eq(books.authorId, authors.id))
		.leftJoin(series, eq(books.seriesId, series.id))
		.where(eq(books.statusId, STATUS_CURRENT))
		.orderBy(desc(books.updatedAt))
		.limit(limit);

	return result.map((row) => ({
		id: row.id,
		title: row.title,
		coverUrl: row.coverImageUrl,
		author: row.authorName,
		series: row.seriesTitle,
		bookNum: row.bookNum,
		rating: row.rating
	}));
}

/**
 * Get recently read books for widget
 */
export async function getRecentReads(limit: number = 5): Promise<WidgetBook[]> {
	const result = await db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			bookNum: books.bookNum,
			rating: books.rating,
			authorName: authors.name,
			seriesTitle: series.title
		})
		.from(books)
		.leftJoin(authors, eq(books.authorId, authors.id))
		.leftJoin(series, eq(books.seriesId, series.id))
		.where(and(eq(books.statusId, STATUS_READ), isNotNull(books.completedDate)))
		.orderBy(desc(books.completedDate))
		.limit(limit);

	return result.map((row) => ({
		id: row.id,
		title: row.title,
		coverUrl: row.coverImageUrl,
		author: row.authorName,
		series: row.seriesTitle,
		bookNum: row.bookNum,
		rating: row.rating
	}));
}

/**
 * Get reading statistics for widget
 */
export async function getWidgetStats(): Promise<WidgetStats> {
	const currentYear = new Date().getFullYear();
	const yearStart = `${currentYear}-01-01`;

	// Get counts
	const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(books);
	const [readResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.statusId, STATUS_READ));
	const [currentResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.statusId, STATUS_CURRENT));
	const [thisYearResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(sql`${books.completedDate} >= ${yearStart}`);

	// Get average rating
	const [avgResult] = await db
		.select({ avg: sql<number>`avg(${books.rating})` })
		.from(books)
		.where(isNotNull(books.rating));

	// Get author and series counts
	const [authorsResult] = await db.select({ count: sql<number>`count(*)` }).from(authors);
	const [seriesResult] = await db.select({ count: sql<number>`count(*)` }).from(series);

	const totalBooks = totalResult?.count || 0;
	const booksRead = readResult?.count || 0;

	return {
		totalBooks,
		booksRead,
		currentlyReading: currentResult?.count || 0,
		booksThisYear: thisYearResult?.count || 0,
		avgRating: avgResult?.avg ? Math.round(avgResult.avg * 10) / 10 : null,
		totalAuthors: authorsResult?.count || 0,
		totalSeries: seriesResult?.count || 0,
		completionPercent: totalBooks > 0 ? Math.round((booksRead / totalBooks) * 100) : 0
	};
}

/**
 * Get reading goal progress for widget
 */
export async function getWidgetGoal(): Promise<WidgetGoal | null> {
	const currentYear = new Date().getFullYear();

	const [goal] = await db
		.select()
		.from(readingGoals)
		.where(and(eq(readingGoals.year, currentYear), eq(readingGoals.challengeType, 'books')))
		.limit(1);

	if (!goal || !goal.targetBooks) {
		return null;
	}

	// Count books completed this year
	const yearStart = `${currentYear}-01-01`;
	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(sql`${books.completedDate} >= ${yearStart}`);

	const current = countResult?.count || 0;
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
 * Get widget data based on type
 */
export async function getWidgetData(
	type: WidgetType,
	limit: number = 5
): Promise<{ books?: WidgetBook[]; stats?: WidgetStats; goal?: WidgetGoal | null }> {
	switch (type) {
		case 'currently-reading':
			return { books: await getCurrentlyReading(limit) };
		case 'recent-reads':
			return { books: await getRecentReads(limit) };
		case 'stats':
			return { stats: await getWidgetStats() };
		case 'goal':
			return { goal: await getWidgetGoal() };
		default:
			throw new Error(`Unknown widget type: ${type}`);
	}
}
