import { db, series, bookSeries, books, seriesStatuses, genres, statuses, bookAuthors, authors, bookTags, tags } from '$lib/server/db';
import { eq, like, sql, desc, asc, and, isNotNull, ne, inArray, or, type SQL } from 'drizzle-orm';
import type { BookCardData } from '$lib/types';
import type { Series, NewSeries } from '$lib/server/db/schema';
import { getBooksCardData } from './bookService';
import { getViewerSeriesStatuses } from './statusService';
import { viewerBooks as vub } from './personalState';
import { duplicateNameKey } from '$lib/server/utils/nameNormalization';

/**
 * Generate SQL condition to filter books by user's library: the viewer's own (user_books). Other
 * members' personal books never count toward a viewer's series figures; no viewer matches nothing.
 */
function getUserLibraryCondition(userId: number | undefined, bookTableAlias: string = 'books') {
	if (!userId) {
		return sql.raw('1=0');
	}
	return sql`${sql.raw(bookTableAlias)}.id IN (SELECT bookId FROM user_books WHERE userId = ${userId})`;
}

/** The same library condition on the Drizzle books table */
function libraryBooksCondition(userId: number | undefined): SQL {
	return userId ? sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})` : sql`1=0`;
}

/** Series statuses as this viewer sees them (statusService.getViewerSeriesStatuses), names and colours resolved */
async function withViewerSeriesStatus<T extends { id: number; statusId: number | null; statusName?: string | null; statusColor?: string | null; statusIcon?: string | null }>(rows: T[], userId: number | undefined): Promise<T[]> {
	if (rows.length === 0 || !userId) return rows;
	const viewer = await getViewerSeriesStatuses(rows.map((r) => r.id), userId);
	const statusRows = await db.select().from(seriesStatuses);
	const byId = new Map(statusRows.map((st) => [st.id, st]));
	return rows.map((row) => {
		const statusId = viewer.get(row.id) ?? row.statusId;
		if (statusId === row.statusId) return row;
		const st = statusId === null ? undefined : byId.get(statusId);
		return { ...row, statusId, statusName: st?.name ?? null, statusColor: st?.color ?? null, statusIcon: st?.icon ?? null };
	});
}

// The Audible suggestion columns (2.27.0) are server bookkeeping, not card data
type SeriesAudibleColumns = 'audibleAsin' | 'audibleSeriesTitle' | 'audibleStatus' | 'audibleCheckedAt' | 'audibleRefreshedAt' | 'audibleRefreshError';

export interface SeriesCardData extends Omit<Series, SeriesAudibleColumns> {
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

export type SeriesSort = 'title' | 'author' | 'bookCount' | 'progress' | 'rating' | 'createdAt' | 'updatedAt';

export interface GetSeriesOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: SeriesSort;
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
	const libCondBooks = libraryBooksCondition(userId);

	// Build where clause
	const whereClause = search ? like(series.title, `%${search}%`) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(series)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get the "Read" status ID for completion calculations (the progress sort needs it too)
	const readStatus = await db
		.select({ id: statuses.id })
		.from(statuses)
		.where(eq(statuses.key, 'READ'))
		.limit(1);
	const readStatusId = readStatus[0]?.id;

	// Build book count subquery that respects user library filter
	const bookCountSubquery = sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = series.id AND ${libCond})`.as('book_count');

	// sort and order are never interpolated: direction is one of two literals, the column comes from
	// the switch. Each key matches what the card and row display; nulls last, series.id last.
	const dir = order === 'desc' ? sql`DESC` : sql`ASC`;
	const byTitle = sql`series.title COLLATE NOCASE ASC`;
	// Status and rating are the viewer's own row (vub); everything stays table-qualified
	const seriesBooksWhere = sql`FROM bookseries bs JOIN books b ON b.id = bs.bookId
		LEFT JOIN user_books vub ON vub.bookId = b.id AND vub.userId = ${userId ?? -1}
		WHERE bs.seriesId = series.id AND ${libCond}`;
	let orderTerms: SQL[];
	switch (sort) {
		case 'bookCount':
			orderTerms = [sql`book_count ${dir}`, byTitle, sql`series.id ASC`];
			break;
		case 'progress':
			// NULL for an empty series, so it sorts last instead of as 0%
			orderTerms = [sql`(SELECT CASE WHEN COUNT(*) = 0 THEN NULL
				ELSE ROUND(SUM(CASE WHEN vub.statusId = ${readStatusId ?? 0} THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) END
				${seriesBooksWhere}) ${dir} NULLS LAST`, byTitle, sql`series.id ASC`];
			break;
		case 'rating':
			orderTerms = [sql`(SELECT ROUND(AVG(vub.rating), 1) ${seriesBooksWhere} AND vub.rating > 0) ${dir} NULLS LAST`, byTitle, sql`series.id ASC`];
			break;
		case 'author':
			// Same pick as primaryAuthor below: most primary credits, then most credits, then author id
			orderTerms = [sql`(SELECT a.name FROM bookauthors ba JOIN authors a ON a.id = ba.authorId
				WHERE ba.bookId IN (SELECT bs.bookId ${seriesBooksWhere})
				GROUP BY ba.authorId
				ORDER BY SUM(CASE WHEN ba.isPrimary = 1 THEN 1 ELSE 0 END) DESC, COUNT(*) DESC, ba.authorId ASC
				LIMIT 1) COLLATE NOCASE ${dir} NULLS LAST`, byTitle, sql`series.id ASC`];
			break;
		case 'createdAt':
			orderTerms = [sql`series.createdAt ${dir} NULLS LAST`, sql`series.id ${dir}`];
			break;
		case 'updatedAt':
			orderTerms = [sql`series.updatedAt ${dir} NULLS LAST`, sql`series.id ${dir}`];
			break;
		default:
			orderTerms = [sql`series.title COLLATE NOCASE ${dir}`, sql`series.id ASC`];
	}

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
		.orderBy(...orderTerms)
		.limit(limit)
		.offset(offset);

	// Enrich each series with additional data
	const viewerItems = await withViewerSeriesStatus(basicItems, userId);
	const items: SeriesCardData[] = await Promise.all(
		viewerItems.map(async (s) => {
			// Get books in this series with their details (filtered by user library)
			const seriesBooks = await db
				.select({
					id: books.id,
					title: books.title,
					coverImageUrl: books.coverImageUrl,
					bookNum: bookSeries.bookNum,
					statusId: vub.statusId,
					rating: vub.rating,
					genreId: books.genreId
				})
				.from(books)
				.innerJoin(bookSeries, eq(books.id, bookSeries.bookId))
				.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
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
						desc(sql`COUNT(*)`),
						asc(bookAuthors.authorId)
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

/** storedStatus: the series' own stored status (the edit form) instead of the viewer's derived one */
export async function getSeriesWithBooks(id: number, userId?: number, opts: { storedStatus?: boolean } = {}): Promise<{
	series: SeriesWithBookCount;
	books: BookCardData[];
	stats: SeriesStats;
} | null> {
	// User library condition for filtering books: the viewer's own
	const libCondBooks = libraryBooksCondition(userId);

	// Build book count subquery that respects user library filter
	const bookCountSubquery = sql<number>`(SELECT COUNT(*) FROM bookseries bs
			INNER JOIN books b ON b.id = bs.bookId
			WHERE bs.seriesId = ${series.id}
			AND ${getUserLibraryCondition(userId, 'b')})`;

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

	const [seriesData] = opts.storedStatus ? seriesResult : await withViewerSeriesStatus(seriesResult, userId);
	if (!seriesData) return null;

	// Get book IDs with their order in the series (filtered by user library)
	const seriesBookIds = await db
		.select({
			id: books.id,
			title: books.title,
			bookNum: bookSeries.bookNum,
			statusId: vub.statusId,
			rating: vub.rating,
			completedDate: vub.completedDate,
			pageCount: books.pageCount
		})
		.from(books)
		.innerJoin(bookSeries, eq(books.id, bookSeries.bookId))
		.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
		.where(and(eq(bookSeries.seriesId, id), libCondBooks))
		.orderBy(asc(bookSeries.bookNum));

	const bookIds = seriesBookIds.map((b) => b.id);

	// Get full book card data using the shared helper
	const booksData = await getBooksCardData(bookIds, userId ?? null);

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

export interface SeriesNoteBook {
	id: number;
	title: string;
	bookNum: number | null;
	comments: string;
	completedDate: string | null;
	lastReadAt: string | null;
	startReadingDate: string | null;
}

/**
 * The viewer's own notes on the books of each series, for the book page's series-notes digest.
 * Notes, dates and last-read come from the viewer's user_books row only; only books with notes,
 * in series order. No viewer gets nothing.
 */
export async function getSeriesBookNotes(seriesIds: number[], userId?: number): Promise<Record<number, SeriesNoteBook[]>> {
	const result: Record<number, SeriesNoteBook[]> = {};
	if (seriesIds.length === 0 || !userId) return result;

	const rows = await db
		.select({
			seriesId: bookSeries.seriesId,
			id: books.id,
			title: books.title,
			bookNum: bookSeries.bookNum,
			comments: vub.comments,
			completedDate: vub.completedDate,
			lastReadAt: vub.lastReadAt,
			startReadingDate: vub.startReadingDate
		})
		.from(books)
		.innerJoin(bookSeries, eq(books.id, bookSeries.bookId))
		.innerJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId)))
		.where(and(inArray(bookSeries.seriesId, seriesIds), sql`TRIM(COALESCE(${vub.comments}, '')) != ''`))
		.orderBy(asc(bookSeries.bookNum), asc(books.id));

	for (const { seriesId, ...row } of rows) {
		(result[seriesId] ??= []).push({ ...row, comments: row.comments ?? '' });
	}
	return result;
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

/** Series statuses (DNF, Parked) whose series are kept out of Next Up and Up Next; empty when neither row exists */
export async function getExcludedSeriesStatusIds(): Promise<number[]> {
	// By key or name, as recomputeSeriesStatuses resolves them, so a row with no key still counts
	const rows = await db.select({ id: seriesStatuses.id, name: seriesStatuses.name, key: seriesStatuses.key }).from(seriesStatuses);
	return rows
		.filter((s) => ['DNF', 'PARKED'].some((w) => s.key?.toUpperCase() === w || s.name?.trim().toUpperCase() === w))
		.map((s) => s.id);
}

/**
 * A statusId / genreId from a request body: null, undefined or '' clears it (id null); anything
 * else must be the integer id of an existing seriesstatuses / genres row, otherwise valid is false
 */
export async function checkSeriesRefId(
	value: unknown,
	ref: 'status' | 'genre'
): Promise<{ valid: boolean; id: number | null }> {
	if (value === null || value === undefined || value === '') return { valid: true, id: null };
	if (typeof value !== 'number' || !Number.isInteger(value)) return { valid: false, id: null };
	const table = ref === 'status' ? seriesStatuses : genres;
	const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, value)).limit(1);
	return row ? { valid: true, id: row.id } : { valid: false, id: null };
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
		const normalized = duplicateNameKey(s.title, (t) =>
			t.replace(/^the /, '').replace(/ series$/, '')
		);

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

	groups.forEach((seriesList) => {
		if (seriesList.length > 1) {
			// Filter out series where all pairs are ignored
			const nonIgnored = filterIgnoredPairs(seriesList, ignoredPairs);
			if (nonIgnored.length > 1) {
				// Label the group with a real title; the grouping key is not display text
				duplicates.push({ title: nonIgnored[0].title, series: nonIgnored });
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
