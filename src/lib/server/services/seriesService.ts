import { db, series, bookSeries, books, seriesStatuses, genres, statuses, bookAuthors, authors, bookTags, tags } from '$lib/server/db';
import { eq, like, sql, desc, asc, and, isNotNull, ne, inArray, or } from 'drizzle-orm';
import type { BookCardData } from '$lib/types';
import type { Series, NewSeries } from '$lib/server/db/schema';
import { getBooksCardData } from './bookService';

/**
 * Generate SQL condition to filter books by user's library
 */
function getUserLibraryCondition(userId: number | undefined, bookTableAlias: string = 'books') {
	if (!userId) {
		return sql.raw(`${bookTableAlias}.libraryType = 'personal'`);
	}
	return sql.raw(`(${bookTableAlias}.libraryType = 'personal' OR ${bookTableAlias}.id IN (SELECT bookId FROM user_books WHERE userId = ${userId}))`);
}

export interface SeriesCardData extends Series {
	bookCount: number;
	readBooks: number;
	completionPercentage: number;
	averageRating: number | null;
	statusName?: string | null;
	statusColor?: string | null;
	statusIcon?: string | null;
	genreName?: string | null;
	genreColor?: string | null;
	genreIcon?: string | null;
	inferredGenre?: {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	} | null;
	primaryAuthor?: {
		id: number;
		name: string;
	} | null;
	nextBook?: {
		id: number;
		title: string;
		bookNum: number | null;
	} | null;
	coverBook?: {
		id: number;
		title: string;
		coverImageUrl: string | null;
	} | null;
}

export interface SeriesWithBookCount extends Series {
	bookCount: number;
	statusName?: string | null;
	statusColor?: string | null;
	statusIcon?: string | null;
	genreName?: string | null;
}

export interface SeriesStats {
	totalBooks: number;
	readBooks: number;
	unreadBooks: number;
	completionPercentage: number;
	averageRating: number | null;
	totalPages: number;
	avgPages: number;
	lastReadBook: string | null;
	nextBook: string | null;
	gapAnalysis: {
		hasGaps: boolean;
		missingBooks: number[];
	};
}

export interface GetSeriesOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'title' | 'bookCount' | 'createdAt';
	order?: 'asc' | 'desc';
	userId?: number; // Filter stats to user's library
}

export async function getAllSeries(options: GetSeriesOptions = {}): Promise<{
	items: SeriesCardData[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 24, search, sort = 'title', order = 'asc', userId } = options;
	const offset = (page - 1) * limit;

	// User library condition for filtering
	const libCond = getUserLibraryCondition(userId, 'b');
	const libCondBooks = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Build where clause
	const whereClause = search ? like(series.title, `%${search}%`) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(series)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get series with book count
	const orderColumn = sort === 'bookCount' ? sql`book_count` : sort === 'createdAt' ? series.createdAt : series.title;
	const orderDir = order === 'desc' ? desc : asc;

	// Get the "Read" status ID for completion calculations
	const readStatus = await db
		.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, 'READ'))
		.limit(1);
	const readStatusId = readStatus[0]?.id;

	// Build book count subquery that respects user library filter
	const bookCountSubquery = userId
		? sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = ${series.id}
			AND (b.libraryType = 'personal' OR b.id IN (SELECT bookId FROM user_books WHERE userId = ${userId})))`
		: sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = ${series.id}
			AND b.libraryType = 'personal')`;

	const basicItems = await db
		.select({
			id: series.id,
			title: series.title,
			description: series.description,
			numBooks: series.numBooks,
			comments: series.comments,
			statusId: series.statusId,
			genreId: series.genreId,
			createdAt: series.createdAt,
			updatedAt: series.updatedAt,
			bookCount: bookCountSubquery,
			statusName: seriesStatuses.name,
			statusColor: seriesStatuses.color,
			statusIcon: seriesStatuses.icon,
			genreName: genres.name,
			genreColor: genres.color,
			genreIcon: genres.icon
		})
		.from(series)
		.leftJoin(seriesStatuses, eq(series.statusId, seriesStatuses.id))
		.leftJoin(genres, eq(series.genreId, genres.id))
		.where(whereClause)
		.orderBy(orderDir(orderColumn))
		.limit(limit)
		.offset(offset);

	// Enrich each series with additional data
	const items: SeriesCardData[] = await Promise.all(
		basicItems.map(async (s) => {
			// Get books in this series with their details (filtered by user library)
			const seriesBooks = await db
				.select({
					id: books.id,
					title: books.title,
					coverImageUrl: books.coverImageUrl,
					bookNum: bookSeries.bookNum,
					statusId: books.statusId,
					rating: books.rating,
					genreId: books.genreId
				})
				.from(books)
				.innerJoin(bookSeries, eq(books.id, bookSeries.bookId))
				.where(and(eq(bookSeries.seriesId, s.id), libCondBooks))
				.orderBy(asc(bookSeries.bookNum));

			// Calculate read books and completion
			const readBooks = readStatusId
				? seriesBooks.filter(b => b.statusId === readStatusId).length
				: 0;
			const bookCount = seriesBooks.length;
			const completionPercentage = bookCount > 0 ? Math.round((readBooks / bookCount) * 100) : 0;

			// Calculate average rating
			const booksWithRatings = seriesBooks.filter(b => b.rating != null && b.rating > 0);
			const averageRating = booksWithRatings.length > 0
				? parseFloat((booksWithRatings.reduce((sum, b) => sum + (b.rating || 0), 0) / booksWithRatings.length).toFixed(1))
				: null;

			// Get primary author (most common author across books in series)
			let primaryAuthor: { id: number; name: string } | null = null;
			if (seriesBooks.length > 0) {
				const bookIds = seriesBooks.map(b => b.id);
				const authorStats = await db
					.select({
						authorId: bookAuthors.authorId,
						authorName: authors.name,
						count: sql<number>`COUNT(*)`,
						primaryCount: sql<number>`SUM(CASE WHEN ${bookAuthors.isPrimary} = 1 THEN 1 ELSE 0 END)`
					})
					.from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(inArray(bookAuthors.bookId, bookIds))
					.groupBy(bookAuthors.authorId)
					.orderBy(
						desc(sql`SUM(CASE WHEN ${bookAuthors.isPrimary} = 1 THEN 1 ELSE 0 END)`),
						desc(sql`COUNT(*)`)
					)
					.limit(1);

				if (authorStats.length > 0) {
					primaryAuthor = {
						id: authorStats[0].authorId,
						name: authorStats[0].authorName
					};
				}
			}

			// Get inferred genre (most common genre among books) if no explicit genre set
			let inferredGenre: { id: number; name: string; color: string | null; icon: string | null } | null = null;
			if (!s.genreId && seriesBooks.length > 0) {
				const booksWithGenre = seriesBooks.filter(b => b.genreId != null);
				if (booksWithGenre.length > 0) {
					// Count genres
					const genreCounts = booksWithGenre.reduce((acc, b) => {
						acc[b.genreId!] = (acc[b.genreId!] || 0) + 1;
						return acc;
					}, {} as Record<number, number>);

					// Find most common genre
					const mostCommonGenreId = Object.entries(genreCounts)
						.sort((a, b) => b[1] - a[1])[0]?.[0];

					if (mostCommonGenreId) {
						const genreResult = await db
							.select({
								id: genres.id,
								name: genres.name,
								color: genres.color,
								icon: genres.icon
							})
							.from(genres)
							.where(eq(genres.id, parseInt(mostCommonGenreId)))
							.limit(1);

						if (genreResult.length > 0) {
							inferredGenre = genreResult[0];
						}
					}
				}
			}

			// Get next book (first unread book by book number)
			let nextBook: { id: number; title: string; bookNum: number | null } | null = null;
			const unreadBooks = seriesBooks
				.filter(b => b.statusId !== readStatusId)
				.sort((a, b) => (a.bookNum || 999) - (b.bookNum || 999));
			if (unreadBooks.length > 0) {
				nextBook = {
					id: unreadBooks[0].id,
					title: unreadBooks[0].title,
					bookNum: unreadBooks[0].bookNum
				};
			}

			// Get cover book (first book with a cover image)
			let coverBook: { id: number; title: string; coverImageUrl: string | null } | null = null;
			const bookWithCover = seriesBooks.find(b => b.coverImageUrl);
			if (bookWithCover) {
				coverBook = {
					id: bookWithCover.id,
					title: bookWithCover.title,
					coverImageUrl: bookWithCover.coverImageUrl
				};
			} else if (seriesBooks.length > 0) {
				// Use first book even without cover
				coverBook = {
					id: seriesBooks[0].id,
					title: seriesBooks[0].title,
					coverImageUrl: seriesBooks[0].coverImageUrl
				};
			}

			return {
				...s,
				bookCount,
				readBooks,
				completionPercentage,
				averageRating,
				primaryAuthor,
				inferredGenre,
				nextBook,
				coverBook
			} as SeriesCardData;
		})
	);

	return {
		items,
		total,
		page,
		limit
	};
}

export async function getSeriesById(id: number): Promise<Series | null> {
	const result = await db.select().from(series).where(eq(series.id, id)).limit(1);
	return result[0] || null;
}

export async function getSeriesWithBooks(id: number, userId?: number): Promise<{
	series: SeriesWithBookCount;
	books: BookCardData[];
	stats: SeriesStats;
} | null> {
	// User library condition for filtering books
	const libCondBooks = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Build book count subquery that respects user library filter
	const bookCountSubquery = userId
		? sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = ${series.id}
			AND (b.libraryType = 'personal' OR b.id IN (SELECT bookId FROM user_books WHERE userId = ${userId})))`
		: sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = ${series.id}
			AND b.libraryType = 'personal')`;

	const seriesResult = await db
		.select({
			id: series.id,
			title: series.title,
			description: series.description,
			numBooks: series.numBooks,
			comments: series.comments,
			statusId: series.statusId,
			genreId: series.genreId,
			createdAt: series.createdAt,
			updatedAt: series.updatedAt,
			bookCount: bookCountSubquery,
			statusName: seriesStatuses.name,
			statusColor: seriesStatuses.color,
			statusIcon: seriesStatuses.icon,
			genreName: genres.name
		})
		.from(series)
		.leftJoin(seriesStatuses, eq(series.statusId, seriesStatuses.id))
		.leftJoin(genres, eq(series.genreId, genres.id))
		.where(eq(series.id, id))
		.limit(1);

	const seriesData = seriesResult[0];
	if (!seriesData) return null;

	// Get book IDs with their order in the series (filtered by user library)
	const seriesBookIds = await db
		.select({
			id: books.id,
			title: books.title,
			bookNum: bookSeries.bookNum,
			statusId: books.statusId,
			rating: books.rating,
			completedDate: books.completedDate,
			pageCount: books.pageCount
		})
		.from(books)
		.innerJoin(bookSeries, eq(books.id, bookSeries.bookId))
		.where(and(eq(bookSeries.seriesId, id), libCondBooks))
		.orderBy(asc(bookSeries.bookNum));

	const bookIds = seriesBookIds.map((b) => b.id);

	// Get full book card data using the shared helper
	const booksData = await getBooksCardData(bookIds);

	// Create a map to preserve the bookNum from series junction
	const bookNumMap = new Map(seriesBookIds.map((b) => [b.id, b.bookNum]));

	// Enrich with series-specific bookNum and ensure seriesName is set
	const enrichedBooks: BookCardData[] = booksData.map((book) => ({
		...book,
		bookNum: bookNumMap.get(book.id) ?? book.bookNum,
		seriesName: seriesData.title
	}));

	// Calculate statistics using the basic book data
	const stats = await calculateSeriesStats(id, seriesBookIds);

	return { series: seriesData as SeriesWithBookCount, books: enrichedBooks, stats };
}

async function calculateSeriesStats(
	seriesId: number,
	seriesBooks: { id: number; title: string; bookNum: number | null; statusId: number | null; rating: number | null; completedDate: string | null; pageCount: number | null }[]
): Promise<SeriesStats> {
	// Get the "Read" status ID
	const readStatus = await db
		.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, 'READ'))
		.limit(1);
	const readStatusId = readStatus[0]?.id;

	const totalBooks = seriesBooks.length;
	const readBooks = readStatusId
		? seriesBooks.filter(b => b.statusId === readStatusId).length
		: 0;
	const unreadBooks = totalBooks - readBooks;
	const completionPercentage = totalBooks > 0 ? Math.round((readBooks / totalBooks) * 100) : 0;

	// Calculate average rating (only for books with ratings)
	const booksWithRatings = seriesBooks.filter(b => b.rating != null && b.rating > 0);
	const averageRating = booksWithRatings.length > 0
		? parseFloat((booksWithRatings.reduce((sum, b) => sum + (b.rating || 0), 0) / booksWithRatings.length).toFixed(1))
		: null;

	// Calculate page stats
	const booksWithPages = seriesBooks.filter(b => b.pageCount != null && b.pageCount > 0);
	const totalPages = booksWithPages.reduce((sum, b) => sum + (b.pageCount || 0), 0);
	const avgPages = booksWithPages.length > 0 ? Math.round(totalPages / booksWithPages.length) : 0;

	// Find last read book (most recent completed date)
	const readBooksWithDates = seriesBooks
		.filter(b => b.statusId === readStatusId && b.completedDate)
		.sort((a, b) => new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime());
	const lastReadBook = readBooksWithDates[0]?.title || null;

	// Find next book to read (first unread book by book number)
	const unreadBooksList = seriesBooks
		.filter(b => b.statusId !== readStatusId)
		.sort((a, b) => (a.bookNum || 999) - (b.bookNum || 999));
	const nextBook = unreadBooksList[0]?.title || null;

	// Gap analysis - find missing book numbers
	const gapAnalysis = detectGaps(seriesBooks);

	return {
		totalBooks,
		readBooks,
		unreadBooks,
		completionPercentage,
		averageRating,
		totalPages,
		avgPages,
		lastReadBook,
		nextBook,
		gapAnalysis
	};
}

function detectGaps(seriesBooks: { bookNum: number | null }[]): { hasGaps: boolean; missingBooks: number[] } {
	const bookNums = seriesBooks
		.map(b => b.bookNum)
		.filter((n): n is number => n != null && Number.isInteger(n) && n > 0)
		.sort((a, b) => a - b);

	if (bookNums.length === 0) {
		return { hasGaps: false, missingBooks: [] };
	}

	const maxNum = Math.max(...bookNums);
	const missingBooks: number[] = [];

	for (let i = 1; i <= maxNum; i++) {
		if (!bookNums.includes(i)) {
			missingBooks.push(i);
		}
	}

	return {
		hasGaps: missingBooks.length > 0,
		missingBooks
	};
}

export async function createSeries(data: NewSeries): Promise<Series> {
	const now = new Date().toISOString();
	const [newSeries] = await db
		.insert(series)
		.values({
			...data,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return newSeries;
}

export async function updateSeries(id: number, data: Partial<NewSeries>): Promise<Series | null> {
	const now = new Date().toISOString();
	const [updated] = await db
		.update(series)
		.set({
			...data,
			updatedAt: now
		})
		.where(eq(series.id, id))
		.returning();
	return updated || null;
}

export async function deleteSeries(id: number): Promise<boolean> {
	const result = await db.delete(series).where(eq(series.id, id));
	return result.changes > 0;
}

export async function getSeriesStatuses() {
	return db.select().from(seriesStatuses).orderBy(asc(seriesStatuses.name));
}

/**
 * Find potential duplicate series based on normalized title matching
 */
export async function findDuplicateSeries(): Promise<
	Array<{ title: string; series: { id: number; title: string; bookCount: number }[] }>
> {
	// Get ignored pairs
	const { getIgnoredPairs } = await import('./ignoredDuplicatesService');
	const ignoredPairs = await getIgnoredPairs('series');

	// Get all series with book count
	const allSeries = await db
		.select({
			id: series.id,
			title: series.title,
			bookCount: sql<number>`(SELECT COUNT(*) FROM bookseries WHERE bookseries.seriesId = ${series.id})`
		})
		.from(series)
		.orderBy(series.title);

	// Group by normalized title
	const groups = new Map<string, Array<{ id: number; title: string; bookCount: number }>>();

	for (const s of allSeries) {
		// Normalize: lowercase, remove extra spaces, common variations
		const normalized = s.title
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.replace(/[:.,-]/g, '')
			.replace(/^the\s+/i, '')
			.replace(/\s+series$/i, '')
			.trim();

		if (!groups.has(normalized)) {
			groups.set(normalized, []);
		}
		groups.get(normalized)!.push(s);
	}

	// Return only groups with duplicates, filtering out ignored pairs
	const duplicates: Array<{
		title: string;
		series: { id: number; title: string; bookCount: number }[];
	}> = [];

	groups.forEach((seriesList, title) => {
		if (seriesList.length > 1) {
			// Filter out series where all pairs are ignored
			const nonIgnored = filterIgnoredPairs(seriesList, ignoredPairs);
			if (nonIgnored.length > 1) {
				duplicates.push({ title, series: nonIgnored });
			}
		}
	});

	return duplicates;
}

function filterIgnoredPairs<T extends { id: number }>(items: T[], ignoredPairs: Set<string>): T[] {
	if (items.length <= 1) return items;

	let hasNonIgnoredPair = false;
	for (let i = 0; i < items.length && !hasNonIgnoredPair; i++) {
		for (let j = i + 1; j < items.length; j++) {
			const pairKey = `${items[i].id}-${items[j].id}`;
			if (!ignoredPairs.has(pairKey)) {
				hasNonIgnoredPair = true;
				break;
			}
		}
	}

	if (!hasNonIgnoredPair) {
		return [];
	}

	return items;
}
