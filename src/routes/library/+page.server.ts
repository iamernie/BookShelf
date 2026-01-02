import type { PageServerLoad } from './$types';
import { db, books, authors, bookAuthors, genres, statuses, userBooks } from '$lib/server/db';
import { eq, sql, and, desc, asc, or, like } from 'drizzle-orm';
import { getLibraryOverview } from '$lib/server/services/statsService';
import { createLogger } from '$lib/server/services/loggerService';
import { getSettingAs } from '$lib/server/services/settingsService';

const log = createLogger('library-page');

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');
	const publicLibraryEnabled = await getSettingAs<boolean>('library.enable_public_library', 'boolean');
	// Default to personal library if public library is disabled
	const defaultFilter = publicLibraryEnabled ? 'public' : 'personal';
	const libraryFilter = url.searchParams.get('library') || defaultFilter;
	const search = url.searchParams.get('q') || '';
	const sortField = url.searchParams.get('sort') || 'createdAt';
	const sortOrder = url.searchParams.get('order') || 'desc';
	const genreId = url.searchParams.get('genre') ? parseInt(url.searchParams.get('genre')!) : null;

	const userId = locals.user?.id;

	log.debug(`Library page load: filter=${libraryFilter}, userId=${userId}`);

	// Build base query
	const conditions = [];

	// Library filter
	if (libraryFilter === 'public') {
		// Show books in the public library
		conditions.push(eq(books.libraryType, 'public'));
	} else if (libraryFilter === 'personal' && userId) {
		// Show only books that the user has added to their personal library (user_books table)
		log.debug(`Filtering personal library for user ${userId}`);

		// Debug: Check how many books are in user's library
		const userBookCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(userBooks)
			.where(eq(userBooks.userId, userId));
		log.debug(`User ${userId} has ${userBookCount[0]?.count || 0} books in their library`);

		conditions.push(
			sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		);
	}
	// 'all' = no libraryType filter (show all books)

	// Search filter
	if (search) {
		conditions.push(
			or(
				like(books.title, `%${search}%`),
				sql`EXISTS (
					SELECT 1 FROM bookauthors ba
					JOIN authors a ON ba.authorId = a.id
					WHERE ba.bookId = books.id AND a.name LIKE ${'%' + search + '%'}
				)`
			)
		);
	}

	// Genre filter
	if (genreId) {
		conditions.push(eq(books.genreId, genreId));
	}

	// Count total
	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(books);

	if (conditions.length > 0) {
		countQuery.where(and(...conditions));
	}

	const totalResult = await countQuery;
	const total = totalResult[0]?.count || 0;

	// Get paginated books
	let booksQuery = db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			rating: books.rating,
			libraryType: books.libraryType,
			pageCount: books.pageCount,
			createdAt: books.createdAt,
			genreId: books.genreId,
			genreName: genres.name,
			genreColor: genres.color
		})
		.from(books)
		.leftJoin(genres, eq(books.genreId, genres.id));

	if (conditions.length > 0) {
		booksQuery = booksQuery.where(and(...conditions)) as typeof booksQuery;
	}

	// Sort - use explicit column mapping
	type SortableBookColumn = typeof books.title | typeof books.createdAt | typeof books.rating;
	let sortColumn: SortableBookColumn;
	switch (sortField) {
		case 'title': sortColumn = books.title; break;
		case 'rating': sortColumn = books.rating; break;
		default: sortColumn = books.createdAt;
	}
	booksQuery = booksQuery
		.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
		.limit(limit)
		.offset((page - 1) * limit) as typeof booksQuery;

	const bookResults = await booksQuery;

	// Get authors for each book
	const bookIds = bookResults.map(b => b.id);
	const authorsData = bookIds.length > 0
		? await db
				.select({
					bookId: bookAuthors.bookId,
					authorName: authors.name
				})
				.from(bookAuthors)
				.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
				.where(sql`${bookAuthors.bookId} IN (${sql.join(bookIds.map(id => sql`${id}`), sql`, `)})`)
		: [];

	// Group authors by book
	const authorsByBook = new Map<number, string[]>();
	for (const a of authorsData) {
		if (!authorsByBook.has(a.bookId)) {
			authorsByBook.set(a.bookId, []);
		}
		authorsByBook.get(a.bookId)!.push(a.authorName);
	}

	// Check which books are in user's library (if logged in)
	let userLibraryBookIds = new Set<number>();
	if (userId && bookIds.length > 0) {
		const userLibrary = await db
			.select({ bookId: userBooks.bookId })
			.from(userBooks)
			.where(
				and(
					eq(userBooks.userId, userId),
					sql`${userBooks.bookId} IN (${sql.join(bookIds.map(id => sql`${id}`), sql`, `)})`
				)
			);
		userLibraryBookIds = new Set(userLibrary.map(ub => ub.bookId));
	}

	// Format books for display
	const booksWithDetails = bookResults.map(book => ({
		...book,
		authors: authorsByBook.get(book.id) || [],
		inUserLibrary: userLibraryBookIds.has(book.id)
	}));

	// Get library overview stats
	const libraryStats = userId ? await getLibraryOverview(userId) : null;

	// Get all genres for filter
	const allGenres = await db
		.select({
			id: genres.id,
			name: genres.name,
			color: genres.color
		})
		.from(genres)
		.orderBy(asc(genres.displayOrder), asc(genres.name));

	return {
		books: booksWithDetails,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			library: libraryFilter,
			search,
			sort: sortField,
			order: sortOrder,
			genre: genreId
		},
		libraryStats,
		genres: allGenres,
		user: locals.user,
		publicLibraryEnabled
	};
};
