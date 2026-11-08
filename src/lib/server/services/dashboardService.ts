/**
 * Dashboard Service
 * Aggregates data for the enhanced dashboard with customizable widgets
 */

import { db, books, authors, series, statuses, bookAuthors, bookSeries, genres, formats, tags, bookTags, settings, userBooks, magicShelves } from '$lib/server/db';
import { eq, sql, desc, asc, and, isNotNull, isNull, ne, or, count, inArray, notInArray } from 'drizzle-orm';
import { currentYearInAppTz } from '$lib/server/utils/appTime';
import { getBooksCardData } from './bookService';
import { viewerBooks as vub } from './personalState';
import { getGoalForDashboard } from './goalsService';
import { getDashboardConfig, getEnabledSections, type DashboardConfig, type DashboardSection, type FilterConfig } from './userPreferencesService';
import { getShelfBooks } from './magicShelfService';
import { getExcludedSeriesStatusIds } from './seriesService';
import type { BookCardData } from '$lib/types';
import { reachableEntityCond, type Viewer } from './libraryShareService';

// Status keys
const STATUS_KEYS = {
	READ: 'READ',
	CURRENT: 'CURRENT',
	NEXT: 'NEXT',
	DNF: 'DNF'
};

// Dashboard widget types
export type DashboardWidgetType =
	| 'stats-overview'
	| 'reading-goal'
	| 'format-breakdown'
	| 'genre-distribution'
	| 'reading-streak'
	| 'continue-reading'
	| 'recently-added'
	| 'recently-completed'
	| 'up-next-series'
	| 'random-tbr'
	| 'top-authors'
	| 'monthly-chart';

export interface DashboardWidgetConfig {
	id: DashboardWidgetType;
	enabled: boolean;
	order: number;
}

export const DEFAULT_WIDGET_CONFIG: DashboardWidgetConfig[] = [
	{ id: 'stats-overview', enabled: true, order: 0 },
	{ id: 'reading-goal', enabled: true, order: 1 },
	{ id: 'continue-reading', enabled: true, order: 2 },
	{ id: 'up-next-series', enabled: true, order: 3 },
	{ id: 'recently-added', enabled: true, order: 4 },
	{ id: 'recently-completed', enabled: true, order: 5 },
	{ id: 'format-breakdown', enabled: true, order: 6 },
	{ id: 'genre-distribution', enabled: true, order: 7 },
	{ id: 'random-tbr', enabled: true, order: 8 },
	{ id: 'top-authors', enabled: true, order: 9 },
	{ id: 'monthly-chart', enabled: true, order: 10 }
];

// User library filter helper - filters books by user_books table (personal library)
function getUserLibraryCondition(userId?: number) {
	if (!userId) {
		// No user context - return a condition that matches nothing
		return sql`1=0`;
	}

	// Filter to books in user's personal library (user_books table)
	return sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`;
}

// The viewer's own user_books row, joined as vub wherever a personal field is read
function vubOn(userId?: number) {
	return and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1));
}

// Get status ID by key
async function getStatusId(key: string): Promise<number | null> {
	const result = await db.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, key))
		.limit(1);
	return result[0]?.id ?? null;
}

// ============================================
// Stats Overview
// ============================================
export interface StatsOverview {
	totalBooks: number;
	readThisYear: number;
	currentlyReading: number;
	toBeRead: number;
	totalAuthors: number;
	totalSeries: number;
	avgRating: number | null;
	totalPages: number;
	pagesThisYear: number;
	// New stats
	avgPagesPerBook: number;
	dnfCount: number;
	dnfRate: number; // Percentage
	totalNarrators: number;
}

export async function getStatsOverview(viewer: Viewer): Promise<StatsOverview> {
	const userId = viewer?.id;
	const currentYear = currentYearInAppTz();
	const yearPattern = `${currentYear}%`;
	const libCond = getUserLibraryCondition(userId);

	const [readStatusId, currentStatusId, nextStatusId, dnfStatusId] = await Promise.all([
		getStatusId(STATUS_KEYS.READ),
		getStatusId(STATUS_KEYS.CURRENT),
		getStatusId(STATUS_KEYS.NEXT),
		getStatusId(STATUS_KEYS.DNF)
	]);

	// Import narrators table
	const { narrators } = await import('$lib/server/db');

	const [
		totalBooksRes,
		readThisYearRes,
		currentlyReadingRes,
		tbrRes,
		totalAuthorsRes,
		totalSeriesRes,
		avgRatingRes,
		totalPagesRes,
		pagesThisYearRes,
		// New stats
		dnfCountRes,
		totalNarratorsRes,
		readBooksCountRes
	] = await Promise.all([
		db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).where(libCond),
		readStatusId ? db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, readStatusId), sql`${vub.completedDate} LIKE ${yearPattern}`, libCond))
			: Promise.resolve([{ count: 0 }]),
		currentStatusId ? db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, currentStatusId), libCond))
			: Promise.resolve([{ count: 0 }]),
		// TBR = NEXT status
		nextStatusId ? db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, nextStatusId), libCond))
			: Promise.resolve([{ count: 0 }]),
		// Entity totals through the entity gate, so they equal the /authors and /series list totals
		db.select({ count: sql<number>`count(*)` }).from(authors).where(reachableEntityCond(viewer, 'author', sql`${authors.id}`)),
		db.select({ count: sql<number>`count(*)` }).from(series).where(reachableEntityCond(viewer, 'series', sql`${series.id}`)),
		db.select({ avg: sql<number>`avg(${vub.rating})` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(isNotNull(vub.rating), sql`${vub.rating} > 0`, libCond)),
		db.select({ total: sql<number>`coalesce(sum(pageCount), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(readStatusId ? eq(vub.statusId, readStatusId) : sql`1=1`, libCond)),
		readStatusId ? db.select({ total: sql<number>`coalesce(sum(pageCount), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, readStatusId), sql`${vub.completedDate} LIKE ${yearPattern}`, libCond))
			: Promise.resolve([{ total: 0 }]),
		// DNF count
		dnfStatusId ? db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, dnfStatusId), libCond))
			: Promise.resolve([{ count: 0 }]),
		// Total narrators (the /narrators list total)
		db.select({ count: sql<number>`count(*)` }).from(narrators).where(reachableEntityCond(viewer, 'narrator', sql`${narrators.id}`)),
		// Count of completed books (for DNF rate calculation)
		readStatusId ? db.select({ count: sql<number>`COALESCE(SUM(COALESCE(booksContained, 1)), 0)` }).from(books).leftJoin(vub, vubOn(userId))
			.where(and(eq(vub.statusId, readStatusId), libCond))
			: Promise.resolve([{ count: 0 }])
	]);

	const totalBooks = totalBooksRes[0]?.count ?? 0;
	const dnfCount = dnfCountRes[0]?.count ?? 0;
	const readBooksCount = readBooksCountRes[0]?.count ?? 0;
	const completedAndDnf = readBooksCount + dnfCount;
	const totalPages = totalPagesRes[0]?.total ?? 0;

	return {
		totalBooks,
		readThisYear: readThisYearRes[0]?.count ?? 0,
		currentlyReading: currentlyReadingRes[0]?.count ?? 0,
		toBeRead: tbrRes[0]?.count ?? 0,
		totalAuthors: totalAuthorsRes[0]?.count ?? 0,
		totalSeries: totalSeriesRes[0]?.count ?? 0,
		avgRating: avgRatingRes[0]?.avg ? parseFloat(avgRatingRes[0].avg.toFixed(1)) : null,
		totalPages,
		pagesThisYear: pagesThisYearRes[0]?.total ?? 0,
		// New stats
		avgPagesPerBook: readBooksCount > 0 ? Math.round(totalPages / readBooksCount) : 0,
		dnfCount,
		dnfRate: completedAndDnf > 0 ? Math.round((dnfCount / completedAndDnf) * 100) : 0,
		totalNarrators: totalNarratorsRes[0]?.count ?? 0
	};
}

// ============================================
// Format Breakdown
// ============================================
export interface FormatBreakdown {
	id: number;
	name: string;
	color: string | null;
	icon: string | null;
	count: number;
	percentage: number;
}

export async function getFormatBreakdown(userId?: number): Promise<FormatBreakdown[]> {
	const libCond = getUserLibraryCondition(userId);

	const result = await db.select({
		id: formats.id,
		name: formats.name,
		color: formats.color,
		icon: formats.icon,
		count: sql<number>`count(${books.id})`
	})
		.from(formats)
		.leftJoin(books, and(eq(formats.id, books.formatId), libCond))
		.groupBy(formats.id)
		.orderBy(desc(sql`count(${books.id})`));

	const total = result.reduce((sum, r) => sum + r.count, 0);

	return result
		.filter(r => r.count > 0)
		.map(r => ({
			...r,
			percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
		}));
}

// ============================================
// Genre Distribution
// ============================================
export interface GenreDistribution {
	id: number;
	name: string;
	color: string | null;
	count: number;
	percentage: number;
}

export async function getGenreDistribution(userId?: number, limit = 8): Promise<GenreDistribution[]> {
	const libCond = getUserLibraryCondition(userId);

	const result = await db.select({
		id: genres.id,
		name: genres.name,
		color: genres.color,
		count: sql<number>`count(${books.id})`
	})
		.from(genres)
		.leftJoin(books, and(eq(genres.id, books.genreId), libCond))
		.groupBy(genres.id)
		.orderBy(desc(sql`count(${books.id})`))
		.limit(limit);

	const total = result.reduce((sum, r) => sum + r.count, 0);

	return result
		.filter(r => r.count > 0)
		.map(r => ({
			...r,
			percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
		}));
}

// ============================================
// Monthly Reading Chart Data
// ============================================
export interface MonthlyReadingData {
	month: string;
	shortMonth: string;
	count: number;
}

export async function getMonthlyReadingData(userId?: number, year?: number): Promise<MonthlyReadingData[]> {
	const selectedYear = year || currentYearInAppTz();
	const yearPattern = `${selectedYear}%`;

	const readStatusId = await getStatusId(STATUS_KEYS.READ);
	if (!readStatusId) {
		return getEmptyMonthlyData();
	}

	// The viewer's own completions (same library condition as getStatsOverview)
	const libCond = getUserLibraryCondition(userId);

	// Query books table for completed books this year (consistent with readThisYear stat)
	const result = await db.select({
		month: sql<string>`strftime('%m', ${vub.completedDate})`,
		count: sql<number>`count(*)`
	})
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(
			eq(vub.statusId, readStatusId),
			sql`${vub.completedDate} LIKE ${yearPattern}`,
			libCond
		))
		.groupBy(sql`strftime('%m', ${vub.completedDate})`);

	return buildMonthlyData(result);
}

function buildMonthlyData(result: { month: string; count: number }[]): MonthlyReadingData[] {
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const data: MonthlyReadingData[] = monthNames.map((month, i) => ({
		month,
		shortMonth: shortNames[i],
		count: 0
	}));

	for (const r of result) {
		const monthIndex = parseInt(r.month) - 1;
		if (monthIndex >= 0 && monthIndex < 12) {
			data[monthIndex].count = r.count;
		}
	}

	return data;
}

function getEmptyMonthlyData(): MonthlyReadingData[] {
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return monthNames.map((month, i) => ({ month, shortMonth: shortNames[i], count: 0 }));
}

// ============================================
// Top Authors
// ============================================
export interface TopAuthor {
	id: number;
	name: string;
	photoUrl: string | null;
	bookCount: number;
	readCount: number;
}

export async function getTopAuthors(userId?: number, limit = 5): Promise<TopAuthor[]> {
	const libCond = getUserLibraryCondition(userId);
	const readStatusId = await getStatusId(STATUS_KEYS.READ);

	const result = await db.select({
		id: authors.id,
		name: authors.name,
		photoUrl: authors.photoUrl,
		bookCount: sql<number>`count(distinct ${bookAuthors.bookId})`
	})
		.from(authors)
		.innerJoin(bookAuthors, eq(authors.id, bookAuthors.authorId))
		.innerJoin(books, eq(bookAuthors.bookId, books.id))
		.where(libCond)
		.groupBy(authors.id)
		.orderBy(desc(sql`count(distinct ${bookAuthors.bookId})`))
		.limit(limit);

	// Get read counts for each author
	const authorsWithReadCounts = await Promise.all(
		result.map(async (a) => {
			let readCount = 0;
			if (readStatusId) {
				const readRes = await db.select({ count: sql<number>`count(distinct ${bookAuthors.bookId})` })
					.from(bookAuthors)
					.innerJoin(books, eq(bookAuthors.bookId, books.id)).leftJoin(vub, vubOn(userId))
					.where(and(eq(bookAuthors.authorId, a.id), eq(vub.statusId, readStatusId), libCond));
				readCount = readRes[0]?.count ?? 0;
			}
			return { ...a, readCount };
		})
	);

	return authorsWithReadCounts;
}

// ============================================
// Top Narrators
// ============================================
export interface TopNarrator {
	id: number;
	name: string;
	photoUrl: string | null;
	audiobookCount: number;
	listenedCount: number;
}

export async function getTopNarrators(userId?: number, limit = 5): Promise<TopNarrator[]> {
	const { narrators } = await import('$lib/server/db');
	const libCond = getUserLibraryCondition(userId);
	const readStatusId = await getStatusId(STATUS_KEYS.READ);

	// Get narrators with most books in user's library (using books.narratorId)
	const result = await db.select({
		id: narrators.id,
		name: narrators.name,
		photoUrl: narrators.photoUrl,
		audiobookCount: sql<number>`count(distinct ${books.id})`
	})
		.from(narrators)
		.innerJoin(books, eq(narrators.id, books.narratorId))
		.where(and(isNotNull(books.narratorId), libCond))
		.groupBy(narrators.id)
		.orderBy(desc(sql`count(distinct ${books.id})`))
		.limit(limit);

	// Get listened (completed audiobooks) counts for each narrator
	const narratorsWithListenedCounts = await Promise.all(
		result.map(async (n) => {
			let listenedCount = 0;
			if (readStatusId) {
				const listenedRes = await db.select({ count: sql<number>`count(distinct ${books.id})` })
					.from(books).leftJoin(vub, vubOn(userId))
					.where(and(eq(books.narratorId, n.id), eq(vub.statusId, readStatusId), libCond));
				listenedCount = listenedRes[0]?.count ?? 0;
			}
			return { ...n, listenedCount };
		})
	);

	return narratorsWithListenedCounts;
}

// ============================================
// Highest Rated Book
// ============================================
export interface HighestRatedBook {
	id: number;
	title: string;
	coverImageUrl: string | null;
	rating: number;
	authorName: string | null;
}

export async function getHighestRatedBook(userId?: number): Promise<HighestRatedBook | null> {
	const libCond = getUserLibraryCondition(userId);

	const result = await db.select({
		id: books.id,
		title: books.title,
		coverImageUrl: books.coverImageUrl,
		rating: vub.rating
	})
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(isNotNull(vub.rating), sql`${vub.rating} > 0`, libCond))
		.orderBy(desc(vub.rating), desc(books.updatedAt))
		.limit(1);

	if (result.length === 0) return null;

	const book = result[0];

	// Get author name
	const authorResult = await db.select({
		name: authors.name
	})
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, book.id))
		.limit(1);

	return {
		...book,
		rating: book.rating ?? 0,
		authorName: authorResult[0]?.name ?? null
	};
}

// ============================================
// Continue Reading (Currently Reading books)
// ============================================
export async function getContinueReading(userId?: number, limit = 6): Promise<BookCardData[]> {
	const libCond = getUserLibraryCondition(userId);
	const currentStatusId = await getStatusId(STATUS_KEYS.CURRENT);

	if (!currentStatusId) return [];

	const bookIds = await db.select({ id: books.id })
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(eq(vub.statusId, currentStatusId), libCond))
		// A status change touches the viewer's row, a catalog edit the book: the later of the two
		.orderBy(desc(sql`MAX(COALESCE(${vub.updatedAt}, ''), COALESCE(${books.updatedAt}, ''))`))
		.limit(limit);

	return getBooksCardData(bookIds.map(b => b.id), userId ?? null);
}

// ============================================
// Recently Added
// ============================================
export async function getRecentlyAdded(userId?: number, limit = 12): Promise<BookCardData[]> {
	const libCond = getUserLibraryCondition(userId);

	const bookIds = await db.select({ id: books.id })
		.from(books)
		.where(libCond)
		.orderBy(desc(books.createdAt))
		.limit(limit);

	return getBooksCardData(bookIds.map(b => b.id), userId ?? null);
}

// ============================================
// Recently Completed
// ============================================
export async function getRecentlyCompleted(userId?: number, limit = 6): Promise<BookCardData[]> {
	const libCond = getUserLibraryCondition(userId);
	const readStatusId = await getStatusId(STATUS_KEYS.READ);

	if (!readStatusId) return [];

	const bookIds = await db.select({ id: books.id })
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(
			eq(vub.statusId, readStatusId),
			isNotNull(vub.completedDate),
			ne(vub.completedDate, ''),
			libCond
		))
		.orderBy(desc(vub.completedDate))
		.limit(limit);

	return getBooksCardData(bookIds.map(b => b.id), userId ?? null);
}

// ============================================
// Up Next in Series
// ============================================
export interface UpNextInSeries {
	book: BookCardData;
	seriesId: number;
	seriesTitle: string;
	bookNum: number | null;
	previousBookTitle: string | null;
	seriesProgress: {
		read: number;
		total: number;
		percentage: number;
	};
	// Read / total counts over the viewer's own library (not the /series card counts, which are reach-scoped)
	seriesReadCount: number;
	seriesBookCount: number;
}

export async function getUpNextInSeries(userId?: number, limit = 6): Promise<UpNextInSeries[]> {
	const libCond = getUserLibraryCondition(userId);
	const readStatusId = await getStatusId(STATUS_KEYS.READ);
	const currentStatusId = await getStatusId(STATUS_KEYS.CURRENT);

	if (!readStatusId) return [];

	// Up Next is "my next book", so it stays on the viewer's own library (user_books) and never
	// offers a book they don't hold. Since 2.31.0 the /series cards count every book the viewer can
	// reach (seriesService.getAllSeries), so these counts can be lower than the card's: by design.
	const seriesPageLibCond = libCond;

	// Series set to DNF or Parked are skipped; a series with no status still counts
	const excluded = await getExcludedSeriesStatusIds();
	const statusCond = excluded.length > 0 ? or(isNull(series.statusId), notInArray(series.statusId, excluded)) : undefined;

	// Find series where user has read at least one book
	const seriesWithProgress = await db.selectDistinct({
		seriesId: bookSeries.seriesId,
		seriesTitle: series.title
	})
		.from(bookSeries)
		.innerJoin(series, eq(bookSeries.seriesId, series.id))
		.innerJoin(books, eq(bookSeries.bookId, books.id)).leftJoin(vub, vubOn(userId))
		.where(and(eq(vub.statusId, readStatusId), libCond, statusCond))
		.limit(50); // Check up to 50 series

	const results: UpNextInSeries[] = [];

	for (const s of seriesWithProgress) {
		// Get all books in this series
		const seriesBooks = await db.select({
			bookId: books.id,
			bookNum: bookSeries.bookNum,
			title: books.title,
			statusId: vub.statusId
		})
			.from(bookSeries)
			.innerJoin(books, eq(bookSeries.bookId, books.id)).leftJoin(vub, vubOn(userId))
			.where(and(eq(bookSeries.seriesId, s.seriesId), libCond))
			.orderBy(asc(bookSeries.bookNum));

		const readBooks = seriesBooks.filter(b => b.statusId === readStatusId);
		const unreadBooks = seriesBooks.filter(b => b.statusId !== readStatusId && b.statusId !== currentStatusId);

		// Skip if all books are read or currently reading
		if (unreadBooks.length === 0) continue;

		// Find the next unread book (by book number)
		const sortedUnread = unreadBooks.sort((a, b) => (a.bookNum || 999) - (b.bookNum || 999));
		const nextBook = sortedUnread[0];

		// Find the previous book in sequence
		const previousBook = readBooks
			.filter(b => (b.bookNum || 0) < (nextBook.bookNum || 999))
			.sort((a, b) => (b.bookNum || 0) - (a.bookNum || 0))[0];

		// Get full book data
		const bookData = await getBooksCardData([nextBook.bookId], userId ?? null);
		if (bookData.length === 0) continue;

		// Read / total over the viewer's own library (see seriesPageLibCond)
		const seriesPageBooks = await db.select({ statusId: vub.statusId })
			.from(bookSeries)
			.innerJoin(books, eq(bookSeries.bookId, books.id)).leftJoin(vub, vubOn(userId))
			.where(and(eq(bookSeries.seriesId, s.seriesId), seriesPageLibCond));

		results.push({
			book: bookData[0],
			seriesId: s.seriesId,
			seriesTitle: s.seriesTitle,
			bookNum: nextBook.bookNum,
			previousBookTitle: previousBook?.title || null,
			seriesProgress: {
				read: readBooks.length,
				total: seriesBooks.length,
				percentage: Math.round((readBooks.length / seriesBooks.length) * 100)
			},
			seriesReadCount: seriesPageBooks.filter(b => b.statusId === readStatusId).length,
			seriesBookCount: seriesPageBooks.length
		});

		if (results.length >= limit) break;
	}

	return results;
}

// ============================================
// Random TBR Pick
// ============================================
export async function getRandomTbrPick(userId?: number): Promise<BookCardData | null> {
	const libCond = getUserLibraryCondition(userId);
	const nextStatusId = await getStatusId(STATUS_KEYS.NEXT);
	if (nextStatusId === null) return null;
	const tbrStatusIds = [nextStatusId];

	// Get count first
	const countRes = await db.select({ count: sql<number>`count(*)` })
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(
			sql`${vub.statusId} IN (${sql.join(tbrStatusIds, sql`, `)})`,
			libCond
		));

	const totalCount = countRes[0]?.count ?? 0;
	if (totalCount === 0) return null;

	// Get random book
	const randomOffset = Math.floor(Math.random() * totalCount);
	const randomBook = await db.select({ id: books.id })
		.from(books).leftJoin(vub, vubOn(userId))
		.where(and(
			sql`${vub.statusId} IN (${sql.join(tbrStatusIds, sql`, `)})`,
			libCond
		))
		.limit(1)
		.offset(randomOffset);

	if (randomBook.length === 0) return null;

	const bookData = await getBooksCardData([randomBook[0].id], userId ?? null);
	return bookData[0] || null;
}

// ============================================
// Get Dashboard Widget Settings
// ============================================
export async function getDashboardWidgetSettings(userId?: number): Promise<DashboardWidgetConfig[]> {
	const key = userId ? `dashboard.widgets.user.${userId}` : 'dashboard.widgets.default';

	const result = await db.select()
		.from(settings)
		.where(eq(settings.key, key))
		.limit(1);

	if (result[0]?.value) {
		try {
			return JSON.parse(result[0].value);
		} catch {
			return DEFAULT_WIDGET_CONFIG;
		}
	}

	return DEFAULT_WIDGET_CONFIG;
}

// ============================================
// Save Dashboard Widget Settings
// ============================================
export async function saveDashboardWidgetSettings(config: DashboardWidgetConfig[], userId?: number): Promise<void> {
	const key = userId ? `dashboard.widgets.user.${userId}` : 'dashboard.widgets.default';
	const value = JSON.stringify(config);

	await db.insert(settings)
		.values({
			key,
			value,
			type: 'json',
			category: 'dashboard',
			label: 'Dashboard Widget Configuration',
			description: 'User dashboard widget preferences',
			isSystem: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: settings.key,
			set: { value, updatedAt: new Date().toISOString() }
		});
}

// ============================================
// Smart Collection Data
// ============================================
export interface SmartCollectionData {
	books: BookCardData[];
	shelfName?: string;
	shelfId?: number;
	isCustomFilter?: boolean;
}

/**
 * Get smart collection books for dashboard
 * Can use either a Magic Shelf or a custom inline filter
 */
export async function getSmartCollectionBooks(
	userId: number,
	section: DashboardSection,
	limit = 12
): Promise<SmartCollectionData | null> {
	// If using a Magic Shelf
	if (section.shelfId) {
		try {
			// Get shelf info
			const shelf = await db.select({
				id: magicShelves.id,
				name: magicShelves.name,
				filterJson: magicShelves.filterJson,
				sortField: magicShelves.sortField,
				sortOrder: magicShelves.sortOrder,
				userId: magicShelves.userId,
				isPublic: magicShelves.isPublic
			})
				.from(magicShelves)
				.where(eq(magicShelves.id, section.shelfId))
				.limit(1);

			// Only the viewer's own shelves or a public one, as the shelf page allows
			if (shelf.length === 0 || (shelf[0].userId !== userId && !shelf[0].isPublic)) {
				return null;
			}

			const shelfData = shelf[0];
			const result = await getShelfBooks(section.shelfId, { userId, limit });

			// getShelfBooks returns raw book rows; enrich with author/series/etc. (order preserved)
			const shelfBooks = await getBooksCardData((result?.books || []).map(b => b.id), userId ?? null);

			return {
				books: shelfBooks,
				shelfName: shelfData.name,
				shelfId: shelfData.id,
				isCustomFilter: false
			};
		} catch (e) {
			console.error('[dashboard] Failed to get smart collection books:', e);
			return null;
		}
	}

	// If using a custom inline filter
	if (section.customFilter) {
		try {
			// For now, use the same filter logic as magic shelves
			// This would need to be expanded to support inline filters
			// For MVP, just return empty - users should use existing Magic Shelves
			return {
				books: [],
				isCustomFilter: true
			};
		} catch (e) {
			console.error('[dashboard] Failed to get custom filter books:', e);
			return null;
		}
	}

	return null;
}

// ============================================
// Full Dashboard Data
// ============================================
export interface DashboardData {
	stats: StatsOverview;
	goalData: Awaited<ReturnType<typeof getGoalForDashboard>>;
	continueReading: BookCardData[];
	recentlyAdded: BookCardData[];
	recentlyCompleted: BookCardData[];
	upNextInSeries: UpNextInSeries[];
	randomTbrPick: BookCardData | null;
	formatBreakdown: FormatBreakdown[];
	genreDistribution: GenreDistribution[];
	monthlyReading: MonthlyReadingData[];
	topAuthors: TopAuthor[];
	topNarrators: TopNarrator[];
	highestRatedBook: HighestRatedBook | null;
	widgetConfig: DashboardWidgetConfig[];
	statuses: { id: number; name: string; color: string | null; icon: string | null; key: string | null }[];
	// New dashboard config
	dashboardConfig: DashboardConfig;
	smartCollectionData: SmartCollectionData | null;
	companionSmartCollectionData: SmartCollectionData | null;
	magicShelves: { id: number; name: string; icon: string | null; iconColor: string | null }[];
}

export async function getFullDashboardData(viewer: Viewer): Promise<DashboardData> {
	const userId = viewer?.id;
	// Get dashboard config first (needed to determine what to fetch)
	const dashboardConfig = userId
		? await getDashboardConfig(userId)
		: { sections: [] };

	// Find smart collection section if enabled
	const smartSection = dashboardConfig.sections.find(
		s => s.id === 'smart-collection' && s.enabled
	);

	// Find continue-reading section for companion smart collection
	const continueReadingSection = dashboardConfig.sections.find(
		s => s.id === 'continue-reading' && s.enabled
	);
	const companionIsSmartCollection = continueReadingSection?.companionSection === 'smart-collection';
	const companionShelfId = continueReadingSection?.shelfId;

	const [
		stats,
		goalData,
		continueReading,
		recentlyAdded,
		recentlyCompleted,
		upNextInSeries,
		randomTbrPick,
		formatBreakdown,
		genreDistribution,
		monthlyReading,
		topAuthors,
		topNarrators,
		highestRatedBook,
		widgetConfig,
		allStatuses,
		allMagicShelves,
		smartCollectionData,
		companionSmartCollectionData
	] = await Promise.all([
		getStatsOverview(viewer),
		getGoalForDashboard(userId),
		getContinueReading(userId, 6),
		getRecentlyAdded(userId, 12),
		getRecentlyCompleted(userId, 6),
		getUpNextInSeries(userId, 6),
		getRandomTbrPick(userId),
		getFormatBreakdown(userId),
		getGenreDistribution(userId, 8),
		getMonthlyReadingData(userId),
		getTopAuthors(userId, 5),
		getTopNarrators(userId, 5),
		getHighestRatedBook(userId),
		getDashboardWidgetSettings(userId),
		db.select().from(statuses).orderBy(statuses.sortOrder),
		// Get magic shelves for the settings modal
		userId
			? db.select({
				id: magicShelves.id,
				name: magicShelves.name,
				icon: magicShelves.icon,
				iconColor: magicShelves.iconColor
			})
				.from(magicShelves)
				.where(eq(magicShelves.userId, userId))
				.orderBy(magicShelves.displayOrder)
			: Promise.resolve([]),
		// Get smart collection books if section is enabled
		smartSection && userId
			? getSmartCollectionBooks(userId, smartSection, 12)
			: Promise.resolve(null),
		// Get companion smart collection books if configured
		companionIsSmartCollection && companionShelfId && userId
			? getSmartCollectionBooks(userId, { id: 'smart-collection', enabled: true, order: 0, shelfId: companionShelfId }, 6)
			: Promise.resolve(null)
	]);

	return {
		stats,
		goalData,
		continueReading,
		recentlyAdded,
		recentlyCompleted,
		upNextInSeries,
		randomTbrPick,
		formatBreakdown,
		genreDistribution,
		monthlyReading,
		topAuthors,
		topNarrators,
		highestRatedBook,
		widgetConfig,
		statuses: allStatuses,
		dashboardConfig,
		smartCollectionData,
		companionSmartCollectionData,
		magicShelves: allMagicShelves
	};
}
