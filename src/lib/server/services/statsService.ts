import { db, books, authors, series, genres, narrators, tags, statuses, bookAuthors, bookTags, userBooks } from '$lib/server/db';
import { eq, sql, desc, asc, and, isNotNull, ne, gte, lt, or } from 'drizzle-orm';

// Status key constants (match V1 system statuses)
const STATUS_KEYS = {
	READ: 'READ',
	CURRENT: 'CURRENT',
	NEXT: 'NEXT',
	DNF: 'DNF',
	WISHLIST: 'WISHLIST',
	PARKED: 'PARKED'
};

export interface DashboardStats {
	// Counts
	totalBooks: number;
	readBooks: number;
	totalSeries: number;
	totalAuthors: number;
	totalNarrators: number;
	totalTags: number;
	booksReadThisYear: number;

	// Aggregates
	avgRating: number | null;
	completionPercentage: number;

	// Favorites
	popularAuthor: { id: number; name: string; bookCount: number } | null;
	popularNarrator: { id: number; name: string; bookCount: number } | null;
	popularTag: { id: number; name: string; color: string | null; bookCount: number } | null;

	// Latest
	latestReadBook: {
		id: number;
		title: string;
		coverImageUrl: string | null;
		completedDate: string | null;
		author: string | null;
	} | null;

	// Chart data
	monthlyData: number[];
	statusData: { name: string; color: string; count: number }[];
	genreData: { id: number; name: string; color: string; count: number }[];
	ratingData: number[];
	topAuthorsData: { id: number; name: string; count: number }[];

	currentYear: number;
}

export async function getDashboardStats(userId?: number): Promise<DashboardStats> {
	const currentYear = new Date().getFullYear();
	const yearStart = `${currentYear}-01-01`;
	const yearEnd = `${currentYear + 1}-01-01`;

	// Get READ status ID
	const readStatus = await db.select().from(statuses).where(eq(statuses.key, STATUS_KEYS.READ)).limit(1);
	const dnfStatus = await db.select().from(statuses).where(eq(statuses.key, STATUS_KEYS.DNF)).limit(1);
	const readStatusId = readStatus[0]?.id;
	const dnfStatusId = dnfStatus[0]?.id;

	// User library condition: books in user's personal library (user_books table)
	const userLibraryCondition = userId
		? sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		: sql`1=0`;

	// Parallel queries for counts (filtered by user's library)
	const [
		totalBooksResult,
		readBooksResult,
		totalSeriesResult,
		totalAuthorsResult,
		totalNarratorsResult,
		totalTagsResult,
		booksReadThisYearResult
	] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(books).where(userLibraryCondition),
		readStatusId ? db.select({ count: sql<number>`count(*)` }).from(books).where(and(eq(books.statusId, readStatusId), userLibraryCondition)) : Promise.resolve([{ count: 0 }]),
		db.select({ count: sql<number>`count(*)` }).from(series),
		db.select({ count: sql<number>`count(*)` }).from(authors),
		db.select({ count: sql<number>`count(*)` }).from(narrators),
		db.select({ count: sql<number>`count(*)` }).from(tags),
		readStatusId
			? db.select({ count: sql<number>`count(*)` }).from(books)
				.where(and(
					eq(books.statusId, readStatusId),
					gte(books.completedDate, yearStart),
					lt(books.completedDate, yearEnd),
					userLibraryCondition
				))
			: Promise.resolve([{ count: 0 }])
	]);

	const totalBooks = totalBooksResult[0]?.count ?? 0;
	const readBooks = readBooksResult[0]?.count ?? 0;
	const totalSeries = totalSeriesResult[0]?.count ?? 0;
	const totalAuthors = totalAuthorsResult[0]?.count ?? 0;
	const totalNarrators = totalNarratorsResult[0]?.count ?? 0;
	const totalTags = totalTagsResult[0]?.count ?? 0;
	const booksReadThisYear = booksReadThisYearResult[0]?.count ?? 0;

	// Calculate completion percentage
	const completionPercentage = totalBooks > 0 ? Math.round((readBooks / totalBooks) * 100) : 0;

	// Average rating (for read or DNF books in user's library)
	const avgRatingResult = await db.select({
		avgRating: sql<number>`avg(rating)`
	}).from(books).where(
		and(
			isNotNull(books.rating),
			sql`rating > 0`,
			readStatusId && dnfStatusId
				? sql`statusId IN (${readStatusId}, ${dnfStatusId})`
				: sql`1=1`,
			userLibraryCondition
		)
	);
	const avgRating = avgRatingResult[0]?.avgRating ? parseFloat(avgRatingResult[0].avgRating.toFixed(1)) : null;

	// Popular author (most books in user's library)
	const popularAuthorResult = await db.select({
		id: authors.id,
		name: authors.name,
		bookCount: sql<number>`count(${bookAuthors.bookId})`
	})
		.from(authors)
		.innerJoin(bookAuthors, eq(authors.id, bookAuthors.authorId))
		.innerJoin(books, eq(bookAuthors.bookId, books.id))
		.where(userLibraryCondition)
		.groupBy(authors.id)
		.orderBy(desc(sql`count(${bookAuthors.bookId})`))
		.limit(1);
	const popularAuthor = popularAuthorResult[0] || null;

	// Popular narrator (in user's library)
	const popularNarratorResult = await db.select({
		id: narrators.id,
		name: narrators.name,
		bookCount: sql<number>`count(${books.id})`
	})
		.from(narrators)
		.innerJoin(books, eq(narrators.id, books.narratorId))
		.where(userLibraryCondition)
		.groupBy(narrators.id)
		.orderBy(desc(sql`count(${books.id})`))
		.limit(1);
	const popularNarrator = popularNarratorResult[0] || null;

	// Popular tag (in user's library)
	const popularTagResult = await db.select({
		id: tags.id,
		name: tags.name,
		color: tags.color,
		bookCount: sql<number>`count(${bookTags.bookId})`
	})
		.from(tags)
		.innerJoin(bookTags, eq(tags.id, bookTags.tagId))
		.innerJoin(books, eq(bookTags.bookId, books.id))
		.where(userLibraryCondition)
		.groupBy(tags.id)
		.orderBy(desc(sql`count(${bookTags.bookId})`))
		.limit(1);
	const popularTag = popularTagResult[0] || null;

	// Latest read book (in user's library)
	let latestReadBook = null;
	if (readStatusId) {
		const latestResult = await db.select()
			.from(books)
			.where(and(
				eq(books.statusId, readStatusId),
				isNotNull(books.completedDate),
				ne(books.completedDate, ''),
				userLibraryCondition
			))
			.orderBy(desc(books.completedDate))
			.limit(1);

		if (latestResult[0]) {
			// Get primary author
			const authorResult = await db.select({ name: authors.name })
				.from(bookAuthors)
				.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
				.where(eq(bookAuthors.bookId, latestResult[0].id))
				.orderBy(desc(bookAuthors.isPrimary), asc(bookAuthors.displayOrder))
				.limit(1);

			latestReadBook = {
				id: latestResult[0].id,
				title: latestResult[0].title,
				coverImageUrl: latestResult[0].coverImageUrl,
				completedDate: latestResult[0].completedDate,
				author: authorResult[0]?.name || null
			};
		}
	}

	// Monthly reading data for current year (in user's library)
	const monthlyStatsResult = await db.select({
		month: sql<string>`strftime('%m', completedDate)`,
		count: sql<number>`count(*)`
	})
		.from(books)
		.where(and(
			readStatusId ? eq(books.statusId, readStatusId) : sql`1=1`,
			gte(books.completedDate, yearStart),
			lt(books.completedDate, yearEnd),
			userLibraryCondition
		))
		.groupBy(sql`strftime('%m', completedDate)`);

	const monthlyData = Array(12).fill(0);
	for (const stat of monthlyStatsResult) {
		const monthIndex = parseInt(stat.month) - 1;
		if (monthIndex >= 0 && monthIndex < 12) {
			monthlyData[monthIndex] = stat.count;
		}
	}

	// Status distribution (in user's library)
	const statusDistribution = await db.select({
		id: statuses.id,
		name: statuses.name,
		color: statuses.color,
		count: sql<number>`count(${books.id})`
	})
		.from(statuses)
		.leftJoin(books, and(eq(statuses.id, books.statusId), userLibraryCondition))
		.groupBy(statuses.id)
		.orderBy(asc(statuses.sortOrder));

	const statusData = statusDistribution
		.filter(s => s.count > 0)
		.map(s => ({
			name: s.name,
			color: s.color || '#6c757d',
			count: s.count
		}));

	// Genre distribution (top 8, in user's library)
	const genreDistribution = await db.select({
		id: genres.id,
		name: genres.name,
		color: genres.color,
		count: sql<number>`count(${books.id})`
	})
		.from(genres)
		.leftJoin(books, and(eq(genres.id, books.genreId), userLibraryCondition))
		.groupBy(genres.id)
		.orderBy(desc(sql`count(${books.id})`))
		.limit(8);

	const genreData = genreDistribution
		.filter(g => g.count > 0)
		.map(g => ({
			id: g.id,
			name: g.name,
			color: g.color || '#6c757d',
			count: g.count
		}));

	// Rating distribution (in user's library)
	const ratingDistResult = await db.select({
		rating: books.rating,
		count: sql<number>`count(*)`
	})
		.from(books)
		.where(and(isNotNull(books.rating), sql`rating > 0`, userLibraryCondition))
		.groupBy(books.rating);

	const ratingData = [0, 0, 0, 0, 0];
	for (const r of ratingDistResult) {
		if (r.rating) {
			const index = Math.round(r.rating) - 1;
			if (index >= 0 && index < 5) {
				ratingData[index] += r.count;
			}
		}
	}

	// Top 5 authors by book count (in user's library)
	const topAuthorsResult = await db.select({
		id: authors.id,
		name: authors.name,
		count: sql<number>`count(${bookAuthors.bookId})`
	})
		.from(authors)
		.innerJoin(bookAuthors, eq(authors.id, bookAuthors.authorId))
		.innerJoin(books, eq(bookAuthors.bookId, books.id))
		.where(userLibraryCondition)
		.groupBy(authors.id)
		.orderBy(desc(sql`count(${bookAuthors.bookId})`))
		.limit(5);

	const topAuthorsData = topAuthorsResult.map(a => ({
		id: a.id,
		name: a.name,
		count: a.count
	}));

	return {
		totalBooks,
		readBooks,
		totalSeries,
		totalAuthors,
		totalNarrators,
		totalTags,
		booksReadThisYear,
		avgRating,
		completionPercentage,
		popularAuthor,
		popularNarrator,
		popularTag,
		latestReadBook,
		monthlyData,
		statusData,
		genreData,
		ratingData,
		topAuthorsData,
		currentYear
	};
}

export interface ReadingTimelineData {
	selectedYear: number;
	yearsWithBooks: number[];
	timelineData: {
		name: string;
		books: {
			id: number;
			title: string;
			coverImageUrl: string | null;
			rating: number | null;
			completedDate: string | null;
			author: string | null;
			genre: string | null;
			genreColor: string | null;
		}[];
		count: number;
	}[];
	yearStats: {
		totalBooks: number;
		totalPages: number;
		avgRating: string;
		bestMonth: string;
	};
}

export async function getReadingTimeline(year?: number, userId?: number): Promise<ReadingTimelineData> {
	const selectedYear = year || new Date().getFullYear();

	// Get READ status
	const readStatus = await db.select().from(statuses).where(eq(statuses.key, STATUS_KEYS.READ)).limit(1);
	const readStatusId = readStatus[0]?.id;

	// User library condition: books in user's personal library (user_books table)
	const userLibraryCondition = userId
		? sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		: sql`1=0`;

	if (!readStatusId) {
		return {
			selectedYear,
			yearsWithBooks: [selectedYear],
			timelineData: [],
			yearStats: { totalBooks: 0, totalPages: 0, avgRating: 'N/A', bestMonth: 'N/A' }
		};
	}

	// Get all years with read books (in user's library)
	const yearsResult = await db.selectDistinct({
		year: sql<number>`cast(strftime('%Y', completedDate) as integer)`
	})
		.from(books)
		.where(and(
			eq(books.statusId, readStatusId),
			isNotNull(books.completedDate),
			ne(books.completedDate, ''),
			userLibraryCondition
		))
		.orderBy(desc(sql`strftime('%Y', completedDate)`));

	const yearsWithBooks = yearsResult.map(r => r.year).filter(y => y);
	if (yearsWithBooks.length === 0) {
		yearsWithBooks.push(selectedYear);
	}

	// Get books for selected year (in user's library)
	const yearStart = `${selectedYear}-01-01`;
	const yearEnd = `${selectedYear + 1}-01-01`;

	const booksForYear = await db.select()
		.from(books)
		.where(and(
			eq(books.statusId, readStatusId),
			gte(books.completedDate, yearStart),
			lt(books.completedDate, yearEnd),
			userLibraryCondition
		))
		.orderBy(desc(books.completedDate));

	// Get authors and genres for each book
	const booksWithDetails = await Promise.all(
		booksForYear.map(async (book) => {
			const [authorResult, genreResult] = await Promise.all([
				db.select({ name: authors.name })
					.from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(eq(bookAuthors.bookId, book.id))
					.orderBy(desc(bookAuthors.isPrimary), asc(bookAuthors.displayOrder))
					.limit(1),
				book.genreId
					? db.select().from(genres).where(eq(genres.id, book.genreId)).limit(1)
					: Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				coverImageUrl: book.coverImageUrl,
				rating: book.rating,
				completedDate: book.completedDate,
				pageCount: book.pageCount,
				author: authorResult[0]?.name || null,
				genre: genreResult[0]?.name || null,
				genreColor: genreResult[0]?.color || null
			};
		})
	);

	// Group by month
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];

	const timelineData = monthNames.map((name, index) => ({
		name,
		books: [] as typeof booksWithDetails,
		count: 0
	}));

	for (const book of booksWithDetails) {
		if (book.completedDate) {
			const month = new Date(book.completedDate).getMonth();
			timelineData[month].books.push(book);
			timelineData[month].count++;
		}
	}

	// Year stats
	const totalBooks = booksForYear.length;
	const totalPages = booksForYear.reduce((sum, b) => sum + (b.pageCount || 0), 0);
	const booksWithRating = booksForYear.filter(b => b.rating && b.rating > 0);
	const avgRating = booksWithRating.length > 0
		? (booksWithRating.reduce((sum, b) => sum + (b.rating || 0), 0) / booksWithRating.length).toFixed(1)
		: 'N/A';
	const bestMonth = timelineData.reduce((best, month) => month.count > best.count ? month : best, { count: 0, name: 'N/A' }).name;

	return {
		selectedYear,
		yearsWithBooks,
		timelineData,
		yearStats: {
			totalBooks,
			totalPages,
			avgRating,
			bestMonth
		}
	};
}

// ============================================
// Personal Library Stats (for multi-user/public library mode)
// ============================================

export interface PersonalLibraryStats {
	totalBooksInLibrary: number; // Books in user's personal library
	totalBooksTracked: number;   // All books in the system
	personalBooksRead: number;
	personalBooksReading: number;
	personalAvgRating: number | null;
	personalPagesRead: number;
	publicLibraryCount: number;  // Books in public library not added by user
}

/**
 * Get stats specific to a user's personal library
 * This separates personal reading stats from the total library count
 */
export async function getPersonalLibraryStats(userId: number): Promise<PersonalLibraryStats> {
	// Get status IDs
	const readStatus = await db.select().from(statuses).where(eq(statuses.key, STATUS_KEYS.READ)).limit(1);
	const currentStatus = await db.select().from(statuses).where(eq(statuses.key, STATUS_KEYS.CURRENT)).limit(1);
	const readStatusId = readStatus[0]?.id;
	const currentStatusId = currentStatus[0]?.id;

	// Total books tracked in system
	const totalBooksResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books);
	const totalBooksTracked = totalBooksResult[0]?.count || 0;

	// Books in public library (not personal)
	const publicLibraryResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.libraryType, 'public'));
	const publicLibraryTotal = publicLibraryResult[0]?.count || 0;

	// User's personal library count (from user_books table)
	const userLibraryResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(userBooks)
		.where(eq(userBooks.userId, userId));
	const totalBooksInLibrary = userLibraryResult[0]?.count || 0;

	// User's read books
	const readResult = readStatusId
		? await db
				.select({ count: sql<number>`count(*)` })
				.from(userBooks)
				.where(and(eq(userBooks.userId, userId), eq(userBooks.statusId, readStatusId)))
		: [{ count: 0 }];
	const personalBooksRead = readResult[0]?.count || 0;

	// User's currently reading
	const readingResult = currentStatusId
		? await db
				.select({ count: sql<number>`count(*)` })
				.from(userBooks)
				.where(and(eq(userBooks.userId, userId), eq(userBooks.statusId, currentStatusId)))
		: [{ count: 0 }];
	const personalBooksReading = readingResult[0]?.count || 0;

	// User's average rating
	const avgResult = await db
		.select({ avg: sql<number>`avg(rating)` })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), isNotNull(userBooks.rating), sql`rating > 0`));
	const personalAvgRating = avgResult[0]?.avg ? parseFloat(avgResult[0].avg.toFixed(1)) : null;

	// User's total pages read (from completed books)
	const pagesResult = readStatusId
		? await db
				.select({ total: sql<number>`sum(${books.pageCount})` })
				.from(userBooks)
				.innerJoin(books, eq(userBooks.bookId, books.id))
				.where(and(eq(userBooks.userId, userId), eq(userBooks.statusId, readStatusId)))
		: [{ total: 0 }];
	const personalPagesRead = pagesResult[0]?.total || 0;

	// Public library books that user hasn't added
	const publicNotAddedResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.leftJoin(userBooks, and(eq(books.id, userBooks.bookId), eq(userBooks.userId, userId)))
		.where(and(eq(books.libraryType, 'public'), sql`${userBooks.id} IS NULL`));
	const publicLibraryCount = publicNotAddedResult[0]?.count || 0;

	return {
		totalBooksInLibrary,
		totalBooksTracked,
		personalBooksRead,
		personalBooksReading,
		personalAvgRating,
		personalPagesRead,
		publicLibraryCount
	};
}

/**
 * Get library overview showing both personal and public counts
 */
export async function getLibraryOverview(userId: number): Promise<{
	personal: { total: number; read: number; reading: number };
	public: { total: number; notInPersonal: number };
	all: { total: number };
}> {
	const stats = await getPersonalLibraryStats(userId);

	return {
		personal: {
			total: stats.totalBooksInLibrary,
			read: stats.personalBooksRead,
			reading: stats.personalBooksReading
		},
		public: {
			total: await db.select({ count: sql<number>`count(*)` }).from(books).where(eq(books.libraryType, 'public')).then(r => r[0]?.count || 0),
			notInPersonal: stats.publicLibraryCount
		},
		all: {
			total: stats.totalBooksTracked
		}
	};
}
