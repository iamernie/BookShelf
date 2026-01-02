import { db, books, bookAuthors, bookSeries, bookTags, authors, series, statuses, genres, formats, narrators, tags, userBooks, userBookTags, metadataSuggestions, readingSessions, bookdropQueue, audiobooks } from '$lib/server/db';
import { eq, like, sql, desc, asc, and, or, inArray } from 'drizzle-orm';
import type { Book, NewBook } from '$lib/server/db/schema';

export interface BookWithRelations extends Book {
	authors: { id: number; name: string; role: string | null; isPrimary: boolean | null }[];
	series: { id: number; title: string; bookNum: number | null; bookNumEnd: number | null; comments: string | null }[];
	tags: { id: number; name: string; color: string | null; icon: string | null }[];
	status: { id: number; name: string; color: string | null; icon: string | null } | null;
	genre: { id: number; name: string } | null;
	format: { id: number; name: string; icon: string | null; color: string | null } | null;
	narrator: { id: number; name: string } | null;
	audiobookId?: number | null;
}

export interface GetBooksOptions {
	page?: number;
	limit?: number;
	search?: string;
	statusId?: number;
	genreId?: number;
	formatId?: number;
	tagId?: number;
	authorId?: number;
	seriesId?: number;
	sort?: 'title' | 'createdAt' | 'rating' | 'completedDate' | 'series' | 'status' | 'format' | 'genre';
	order?: 'asc' | 'desc';
	libraryType?: 'personal' | 'public' | 'all';
	userId?: number; // Required for per-user library filtering - shows books owned by user and shared with user
	filterMode?: 'and' | 'or'; // How to combine filter conditions (default: 'and')
}

export async function getBooks(options: GetBooksOptions = {}): Promise<{
	items: BookWithRelations[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 24, search, statusId, genreId, formatId, tagId, authorId, seriesId, sort = 'createdAt', order = 'desc', libraryType = 'personal', userId, filterMode = 'and' } = options;
	const offset = (page - 1) * limit;

	// Build where conditions
	// Base conditions always use AND (library type, search)
	const baseConditions = [];
	// Filter conditions can use AND or OR based on filterMode
	const filterConditions = [];

	// Per-user library filtering
	if (userId) {
		if (libraryType === 'personal') {
			// Show books the user has added to their personal library (user_books table)
			baseConditions.push(
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
			);
		} else if (libraryType === 'public') {
			// Show books in the public library
			baseConditions.push(eq(books.libraryType, 'public'));
		}
		// 'all' shows everything (no libraryType filter)
	} else {
		// No user - only show public books
		baseConditions.push(eq(books.libraryType, 'public'));
	}

	// Search always uses AND with other filters
	if (search) {
		baseConditions.push(like(books.title, `%${search}%`));
	}

	// These are the filterable conditions that can be combined with AND or OR
	if (statusId) {
		filterConditions.push(eq(books.statusId, statusId));
	}
	if (genreId) {
		filterConditions.push(eq(books.genreId, genreId));
	}
	if (formatId) {
		filterConditions.push(eq(books.formatId, formatId));
	}
	if (tagId) {
		const bookIds = await db
			.select({ bookId: bookTags.bookId })
			.from(bookTags)
			.where(eq(bookTags.tagId, tagId));
		if (bookIds.length > 0) {
			filterConditions.push(inArray(books.id, bookIds.map(b => b.bookId)));
		} else if (filterMode === 'and') {
			// In AND mode, if tag has no books, return empty
			return { items: [], total: 0, page, limit };
		}
		// In OR mode, we just skip this filter if no matches
	}
	if (authorId) {
		const bookIds = await db
			.select({ bookId: bookAuthors.bookId })
			.from(bookAuthors)
			.where(eq(bookAuthors.authorId, authorId));
		if (bookIds.length > 0) {
			filterConditions.push(inArray(books.id, bookIds.map(b => b.bookId)));
		} else if (filterMode === 'and') {
			return { items: [], total: 0, page, limit };
		}
	}
	if (seriesId) {
		const bookIds = await db
			.select({ bookId: bookSeries.bookId })
			.from(bookSeries)
			.where(eq(bookSeries.seriesId, seriesId));
		if (bookIds.length > 0) {
			filterConditions.push(inArray(books.id, bookIds.map(b => b.bookId)));
		} else if (filterMode === 'and') {
			return { items: [], total: 0, page, limit };
		}
	}

	// Combine conditions: base conditions AND (filter conditions with AND/OR)
	let whereClause;
	if (filterConditions.length > 0) {
		const filterClause = filterMode === 'or' ? or(...filterConditions) : and(...filterConditions);
		whereClause = baseConditions.length > 0 ? and(...baseConditions, filterClause) : filterClause;
	} else {
		whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get books with sorting
	const orderDir = order === 'asc' ? asc : desc;

	// For related field sorting, we need subqueries
	let orderExpression;
	switch (sort) {
		case 'title':
			orderExpression = orderDir(books.title);
			break;
		case 'rating':
			orderExpression = orderDir(books.rating);
			break;
		case 'completedDate':
			orderExpression = orderDir(books.completedDate);
			break;
		case 'series':
			// Sort by primary series title (via subquery)
			orderExpression = orderDir(sql`(
				SELECT s.title FROM bookseries bs
				JOIN series s ON bs.seriesId = s.id
				WHERE bs.bookId = books.id AND bs.isPrimary = 1
				LIMIT 1
			)`);
			break;
		case 'status':
			// Sort by status name (via subquery)
			orderExpression = orderDir(sql`(
				SELECT st.name FROM statuses st
				WHERE st.id = books.statusId
			)`);
			break;
		case 'format':
			// Sort by format name (via subquery)
			orderExpression = orderDir(sql`(
				SELECT f.name FROM formats f
				WHERE f.id = books.formatId
			)`);
			break;
		case 'genre':
			// Sort by genre name (via subquery)
			orderExpression = orderDir(sql`(
				SELECT g.name FROM genres g
				WHERE g.id = books.genreId
			)`);
			break;
		default:
			orderExpression = orderDir(books.createdAt);
	}

	const booksList = await db
		.select()
		.from(books)
		.where(whereClause)
		.orderBy(orderExpression)
		.limit(limit)
		.offset(offset);

	// Fetch relations for each book
	const items = await Promise.all(booksList.map(async (book) => {
		const [bookAuthorsData, bookSeriesData, bookTagsData, statusData, genreData, formatData, narratorData, audiobookData] = await Promise.all([
			db.select({
				id: authors.id,
				name: authors.name,
				role: bookAuthors.role,
				isPrimary: bookAuthors.isPrimary
			}).from(bookAuthors)
				.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
				.where(eq(bookAuthors.bookId, book.id)),
			db.select({
				id: series.id,
				title: series.title,
				bookNum: bookSeries.bookNum,
				bookNumEnd: bookSeries.bookNumEnd,
				comments: series.comments
			}).from(bookSeries)
				.innerJoin(series, eq(bookSeries.seriesId, series.id))
				.where(eq(bookSeries.bookId, book.id)),
			db.select({
				id: tags.id,
				name: tags.name,
				color: tags.color,
				icon: tags.icon
			}).from(bookTags)
				.innerJoin(tags, eq(bookTags.tagId, tags.id))
				.where(eq(bookTags.bookId, book.id)),
			book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([]),
			book.genreId ? db.select().from(genres).where(eq(genres.id, book.genreId)).limit(1) : Promise.resolve([]),
			book.formatId ? db.select().from(formats).where(eq(formats.id, book.formatId)).limit(1) : Promise.resolve([]),
			book.narratorId ? db.select().from(narrators).where(eq(narrators.id, book.narratorId)).limit(1) : Promise.resolve([]),
			db.select({ id: audiobooks.id }).from(audiobooks).where(eq(audiobooks.bookId, book.id)).limit(1)
		]);

		return {
			...book,
			authors: bookAuthorsData,
			series: bookSeriesData,
			tags: bookTagsData,
			status: statusData[0] ? { id: statusData[0].id, name: statusData[0].name, color: statusData[0].color, icon: statusData[0].icon } : null,
			genre: genreData[0] ? { id: genreData[0].id, name: genreData[0].name } : null,
			format: formatData[0] ? { id: formatData[0].id, name: formatData[0].name, icon: formatData[0].icon, color: formatData[0].color } : null,
			narrator: narratorData[0] ? { id: narratorData[0].id, name: narratorData[0].name } : null,
			audiobookId: audiobookData[0]?.id || null
		};
	}));

	return { items, total, page, limit };
}

export async function getBookById(id: number): Promise<BookWithRelations | null> {
	const book = await db.select().from(books).where(eq(books.id, id)).limit(1);
	if (!book[0]) return null;

	const [bookAuthorsData, bookSeriesData, bookTagsData, statusData, genreData, formatData, narratorData, audiobookData] = await Promise.all([
		db.select({
			id: authors.id,
			name: authors.name,
			role: bookAuthors.role,
			isPrimary: bookAuthors.isPrimary
		}).from(bookAuthors)
			.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
			.where(eq(bookAuthors.bookId, id)),
		db.select({
			id: series.id,
			title: series.title,
			bookNum: bookSeries.bookNum,
			bookNumEnd: bookSeries.bookNumEnd,
			comments: series.comments
		}).from(bookSeries)
			.innerJoin(series, eq(bookSeries.seriesId, series.id))
			.where(eq(bookSeries.bookId, id)),
		db.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon
		}).from(bookTags)
			.innerJoin(tags, eq(bookTags.tagId, tags.id))
			.where(eq(bookTags.bookId, id)),
		book[0].statusId ? db.select().from(statuses).where(eq(statuses.id, book[0].statusId)).limit(1) : Promise.resolve([]),
		book[0].genreId ? db.select().from(genres).where(eq(genres.id, book[0].genreId)).limit(1) : Promise.resolve([]),
		book[0].formatId ? db.select().from(formats).where(eq(formats.id, book[0].formatId)).limit(1) : Promise.resolve([]),
		book[0].narratorId ? db.select().from(narrators).where(eq(narrators.id, book[0].narratorId)).limit(1) : Promise.resolve([]),
		db.select({ id: audiobooks.id }).from(audiobooks).where(eq(audiobooks.bookId, id)).limit(1)
	]);

	return {
		...book[0],
		authors: bookAuthorsData,
		series: bookSeriesData,
		tags: bookTagsData,
		status: statusData[0] ? { id: statusData[0].id, name: statusData[0].name, color: statusData[0].color, icon: statusData[0].icon } : null,
		genre: genreData[0] ? { id: genreData[0].id, name: genreData[0].name } : null,
		format: formatData[0] ? { id: formatData[0].id, name: formatData[0].name, icon: formatData[0].icon, color: formatData[0].color } : null,
		narrator: narratorData[0] ? { id: narratorData[0].id, name: narratorData[0].name } : null,
		audiobookId: audiobookData[0]?.id || null
	};
}

export interface CreateBookData extends Omit<NewBook, 'createdAt' | 'updatedAt'> {
	authors?: { id: number; role?: string; isPrimary?: boolean }[];
	series?: { id: number; bookNum?: number; bookNumEnd?: number }[];
	tagIds?: number[];
	ownerId?: number; // Required for per-user libraries
}

export async function createBook(data: CreateBookData): Promise<Book> {
	const now = new Date().toISOString();
	const { authors: bookAuthorsList, series: bookSeriesList, tagIds, ...bookData } = data;

	// Ensure ownerId is set - books must have an owner
	if (!bookData.ownerId) {
		throw new Error('ownerId is required to create a book');
	}

	const [newBook] = await db
		.insert(books)
		.values({
			...bookData,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// Insert author relations
	if (bookAuthorsList && bookAuthorsList.length > 0) {
		await db.insert(bookAuthors).values(
			bookAuthorsList.map((a, index) => ({
				bookId: newBook.id,
				authorId: a.id,
				role: a.role || 'Author',
				isPrimary: a.isPrimary ?? index === 0,
				displayOrder: index,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Insert series relations
	if (bookSeriesList && bookSeriesList.length > 0) {
		await db.insert(bookSeries).values(
			bookSeriesList.map((s, index) => ({
				bookId: newBook.id,
				seriesId: s.id,
				bookNum: s.bookNum ?? null,
				bookNumEnd: s.bookNumEnd ?? null,
				isPrimary: index === 0,
				displayOrder: index,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Insert tag relations
	if (tagIds && tagIds.length > 0) {
		await db.insert(bookTags).values(
			tagIds.map(tagId => ({
				bookId: newBook.id,
				tagId,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Add book to owner's personal library (user_books table)
	await db.insert(userBooks).values({
		userId: bookData.ownerId,
		bookId: newBook.id,
		statusId: bookData.statusId || null,
		rating: bookData.rating || null,
		startReadingDate: bookData.startReadingDate || null,
		completedDate: bookData.completedDate || null,
		comments: bookData.comments || null,
		addedAt: now,
		createdAt: now,
		updatedAt: now
	});

	return newBook;
}

export async function updateBook(id: number, data: Partial<CreateBookData>): Promise<Book | null> {
	const now = new Date().toISOString();
	const { authors: bookAuthorsList, series: bookSeriesList, tagIds, ...bookData } = data;

	const [updated] = await db
		.update(books)
		.set({
			...bookData,
			updatedAt: now
		})
		.where(eq(books.id, id))
		.returning();

	if (!updated) return null;

	// Update author relations if provided
	if (bookAuthorsList !== undefined) {
		await db.delete(bookAuthors).where(eq(bookAuthors.bookId, id));
		if (bookAuthorsList.length > 0) {
			await db.insert(bookAuthors).values(
				bookAuthorsList.map((a, index) => ({
					bookId: id,
					authorId: a.id,
					role: a.role || 'Author',
					isPrimary: a.isPrimary ?? index === 0,
					displayOrder: index,
					createdAt: now,
					updatedAt: now
				}))
			);
		}
	}

	// Update series relations if provided
	if (bookSeriesList !== undefined) {
		await db.delete(bookSeries).where(eq(bookSeries.bookId, id));
		if (bookSeriesList.length > 0) {
			await db.insert(bookSeries).values(
				bookSeriesList.map((s, index) => ({
					bookId: id,
					seriesId: s.id,
					bookNum: s.bookNum ?? null,
					bookNumEnd: s.bookNumEnd ?? null,
					isPrimary: index === 0,
					displayOrder: index,
					createdAt: now,
					updatedAt: now
				}))
			);
		}
	}

	// Update tag relations if provided
	if (tagIds !== undefined) {
		await db.delete(bookTags).where(eq(bookTags.bookId, id));
		if (tagIds.length > 0) {
			await db.insert(bookTags).values(
				tagIds.map(tagId => ({
					bookId: id,
					tagId,
					createdAt: now,
					updatedAt: now
				}))
			);
		}
	}

	return updated;
}

export async function deleteBook(id: number): Promise<boolean> {
	// Delete related records first (foreign key constraints)
	await db.delete(bookAuthors).where(eq(bookAuthors.bookId, id));
	await db.delete(bookSeries).where(eq(bookSeries.bookId, id));
	await db.delete(bookTags).where(eq(bookTags.bookId, id));
	await db.delete(userBooks).where(eq(userBooks.bookId, id));
	await db.delete(userBookTags).where(eq(userBookTags.bookId, id));
	await db.delete(metadataSuggestions).where(eq(metadataSuggestions.bookId, id));
	await db.delete(readingSessions).where(eq(readingSessions.bookId, id));
	await db.delete(bookdropQueue).where(eq(bookdropQueue.bookId, id));

	// Now delete the book
	const result = await db.delete(books).where(eq(books.id, id));
	return result.changes > 0;
}

// Helper functions to get dropdown options
export async function getStatuses() {
	return db.select().from(statuses).orderBy(asc(statuses.sortOrder));
}

export async function getGenres() {
	return db.select().from(genres).orderBy(asc(genres.name));
}

export async function getFormats() {
	return db.select().from(formats).orderBy(asc(formats.name));
}

export async function getNarrators() {
	return db.select().from(narrators).orderBy(asc(narrators.name));
}

export async function getTags() {
	return db.select().from(tags).orderBy(asc(tags.name));
}

export async function getAllAuthors() {
	return db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name));
}

export async function getAllSeries() {
	return db.select({ id: series.id, title: series.title }).from(series).orderBy(asc(series.title));
}

/**
 * Fetch full BookCardData for a list of book IDs.
 * Used by entity detail pages (authors, series, shelves) to display rich book information.
 */
export async function getBooksCardData(bookIds: number[]): Promise<{
	id: number;
	title: string;
	coverImageUrl: string | null;
	rating: number | null;
	bookNum: number | null;
	ebookPath: string | null;
	authorName: string | null;
	seriesName: string | null;
	summary: string | null;
	completedDate: string | null;
	status: { id: number; name: string; color: string | null; icon: string | null } | null;
	genre: { id: number; name: string } | null;
	format: { id: number; name: string; icon: string | null; color: string | null } | null;
	tags: { id: number; name: string; color: string | null; icon: string | null }[];
}[]> {
	if (bookIds.length === 0) return [];

	// Get base book data
	const booksList = await db
		.select()
		.from(books)
		.where(inArray(books.id, bookIds));

	// Fetch relations for each book in parallel
	const results = await Promise.all(booksList.map(async (book) => {
		const [bookAuthorsData, bookSeriesData, bookTagsData, statusData, genreData, formatData] = await Promise.all([
			db.select({
				id: authors.id,
				name: authors.name,
				isPrimary: bookAuthors.isPrimary
			}).from(bookAuthors)
				.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
				.where(eq(bookAuthors.bookId, book.id))
				.orderBy(desc(bookAuthors.isPrimary), asc(bookAuthors.displayOrder)),
			db.select({
				id: series.id,
				title: series.title,
				bookNum: bookSeries.bookNum,
				isPrimary: bookSeries.isPrimary
			}).from(bookSeries)
				.innerJoin(series, eq(bookSeries.seriesId, series.id))
				.where(eq(bookSeries.bookId, book.id))
				.orderBy(desc(bookSeries.isPrimary), asc(bookSeries.displayOrder)),
			db.select({
				id: tags.id,
				name: tags.name,
				color: tags.color,
				icon: tags.icon
			}).from(bookTags)
				.innerJoin(tags, eq(bookTags.tagId, tags.id))
				.where(eq(bookTags.bookId, book.id)),
			book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([]),
			book.genreId ? db.select().from(genres).where(eq(genres.id, book.genreId)).limit(1) : Promise.resolve([]),
			book.formatId ? db.select().from(formats).where(eq(formats.id, book.formatId)).limit(1) : Promise.resolve([])
		]);

		// Get primary author and series
		const primaryAuthor = bookAuthorsData.find(a => a.isPrimary) || bookAuthorsData[0];
		const primarySeries = bookSeriesData.find(s => s.isPrimary) || bookSeriesData[0];

		return {
			id: book.id,
			title: book.title,
			coverImageUrl: book.coverImageUrl,
			rating: book.rating,
			bookNum: primarySeries?.bookNum ?? null,
			ebookPath: book.ebookPath,
			authorName: primaryAuthor?.name ?? null,
			seriesName: primarySeries?.title ?? null,
			summary: book.summary,
			completedDate: book.completedDate,
			status: statusData[0] ? { id: statusData[0].id, name: statusData[0].name, color: statusData[0].color, icon: statusData[0].icon } : null,
			genre: genreData[0] ? { id: genreData[0].id, name: genreData[0].name } : null,
			format: formatData[0] ? { id: formatData[0].id, name: formatData[0].name, icon: formatData[0].icon, color: formatData[0].color } : null,
			tags: bookTagsData
		};
	}));

	// Maintain original order from bookIds
	const bookMap = new Map(results.map(b => [b.id, b]));
	return bookIds.map(id => bookMap.get(id)!).filter(Boolean);
}

/**
 * Find potential duplicate books based on normalized title matching
 * Returns groups of books that may be duplicates
 */
export async function findDuplicateBooks(): Promise<
	Array<{ title: string; books: { id: number; title: string; authorName: string | null; coverImageUrl: string | null }[] }>
> {
	// Get ignored pairs
	const { getIgnoredPairs } = await import('./ignoredDuplicatesService');
	const ignoredPairs = await getIgnoredPairs('book');

	// Get all books with their primary author
	const allBooks = await db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
		.from(books)
		.orderBy(books.title);

	// Get primary authors for each book
	const bookAuthorsData = await db
		.select({
			bookId: bookAuthors.bookId,
			authorName: authors.name,
			isPrimary: bookAuthors.isPrimary
		})
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.orderBy(desc(bookAuthors.isPrimary));

	// Map book ID to primary author name
	const authorMap = new Map<number, string>();
	for (const ba of bookAuthorsData) {
		if (!authorMap.has(ba.bookId)) {
			authorMap.set(ba.bookId, ba.authorName);
		}
	}

	// Group books by normalized title
	const groups = new Map<string, Array<{ id: number; title: string; authorName: string | null; coverImageUrl: string | null }>>();

	for (const book of allBooks) {
		// Normalize title for comparison
		const normalized = book.title
			.toLowerCase()
			.replace(/\s+/g, ' ')          // collapse whitespace
			.replace(/[:.,-]/g, '')         // remove punctuation
			.replace(/^the\s+/i, '')        // remove leading "the"
			.replace(/^a\s+/i, '')          // remove leading "a"
			.replace(/^an\s+/i, '')         // remove leading "an"
			.trim();

		if (!groups.has(normalized)) {
			groups.set(normalized, []);
		}
		groups.get(normalized)!.push({
			id: book.id,
			title: book.title,
			authorName: authorMap.get(book.id) || null,
			coverImageUrl: book.coverImageUrl
		});
	}

	// Filter to only groups with multiple books (potential duplicates), excluding ignored pairs
	const duplicates: Array<{ title: string; books: { id: number; title: string; authorName: string | null; coverImageUrl: string | null }[] }> = [];
	groups.forEach((bookList, normalizedTitle) => {
		if (bookList.length > 1) {
			// Filter out books where all pairs are ignored
			const nonIgnored = filterIgnoredBookPairs(bookList, ignoredPairs);
			if (nonIgnored.length > 1) {
				duplicates.push({ title: normalizedTitle, books: nonIgnored });
			}
		}
	});

	return duplicates;
}

function filterIgnoredBookPairs<T extends { id: number }>(items: T[], ignoredPairs: Set<string>): T[] {
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

/**
 * Merge one book into another (keeping the target, removing the source)
 * Transfers authors, series, tags, user library entries, etc. to the target book
 */
export async function mergeBooks(targetId: number, sourceId: number): Promise<boolean> {
	if (targetId === sourceId) {
		throw new Error('Cannot merge a book into itself');
	}

	// Check both books exist
	const [target] = await db.select().from(books).where(eq(books.id, targetId)).limit(1);
	const [source] = await db.select().from(books).where(eq(books.id, sourceId)).limit(1);

	if (!target || !source) {
		throw new Error('One or both books not found');
	}

	// Get existing authors/series/tags on target to avoid duplicates
	const [existingAuthors, existingSeries, existingTags] = await Promise.all([
		db.select({ authorId: bookAuthors.authorId }).from(bookAuthors).where(eq(bookAuthors.bookId, targetId)),
		db.select({ seriesId: bookSeries.seriesId }).from(bookSeries).where(eq(bookSeries.bookId, targetId)),
		db.select({ tagId: bookTags.tagId }).from(bookTags).where(eq(bookTags.bookId, targetId))
	]);

	const existingAuthorIds = new Set(existingAuthors.map(a => a.authorId));
	const existingSeriesIds = new Set(existingSeries.map(s => s.seriesId));
	const existingTagIds = new Set(existingTags.map(t => t.tagId));

	const now = new Date().toISOString();

	// Transfer unique authors from source to target
	const sourceAuthors = await db.select().from(bookAuthors).where(eq(bookAuthors.bookId, sourceId));
	for (const author of sourceAuthors) {
		if (!existingAuthorIds.has(author.authorId)) {
			await db.insert(bookAuthors).values({
				bookId: targetId,
				authorId: author.authorId,
				role: author.role,
				isPrimary: false, // Set as non-primary when merging
				displayOrder: author.displayOrder,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	// Transfer unique series from source to target
	const sourceSeries = await db.select().from(bookSeries).where(eq(bookSeries.bookId, sourceId));
	for (const s of sourceSeries) {
		if (!existingSeriesIds.has(s.seriesId)) {
			await db.insert(bookSeries).values({
				bookId: targetId,
				seriesId: s.seriesId,
				bookNum: s.bookNum,
				bookNumEnd: s.bookNumEnd,
				isPrimary: false,
				displayOrder: s.displayOrder,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	// Transfer unique tags from source to target
	const sourceTags = await db.select().from(bookTags).where(eq(bookTags.bookId, sourceId));
	for (const tag of sourceTags) {
		if (!existingTagIds.has(tag.tagId)) {
			await db.insert(bookTags).values({
				bookId: targetId,
				tagId: tag.tagId,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	// Transfer user_books entries (library memberships)
	const sourceUserBooks = await db.select().from(userBooks).where(eq(userBooks.bookId, sourceId));
	for (const ub of sourceUserBooks) {
		// Check if user already has target book
		const [existing] = await db.select().from(userBooks)
			.where(and(eq(userBooks.userId, ub.userId), eq(userBooks.bookId, targetId)))
			.limit(1);
		if (!existing) {
			await db.insert(userBooks).values({
				userId: ub.userId,
				bookId: targetId,
				addedAt: ub.addedAt
			});
		}
	}

	// Transfer user_book_tags
	const sourceUserBookTags = await db.select().from(userBookTags).where(eq(userBookTags.bookId, sourceId));
	for (const ubt of sourceUserBookTags) {
		const [existing] = await db.select().from(userBookTags)
			.where(and(
				eq(userBookTags.userId, ubt.userId),
				eq(userBookTags.bookId, targetId),
				eq(userBookTags.tagId, ubt.tagId)
			))
			.limit(1);
		if (!existing) {
			await db.insert(userBookTags).values({
				userId: ubt.userId,
				bookId: targetId,
				tagId: ubt.tagId
			});
		}
	}

	// If source has an ebook but target doesn't, transfer it
	if (source.ebookPath && !target.ebookPath) {
		await db.update(books).set({ ebookPath: source.ebookPath }).where(eq(books.id, targetId));
	}

	// If source has a cover but target doesn't, transfer it
	if (source.coverImageUrl && !target.coverImageUrl) {
		await db.update(books).set({
			coverImageUrl: source.coverImageUrl,
			originalCoverUrl: source.originalCoverUrl
		}).where(eq(books.id, targetId));
	}

	// Transfer audiobooks from source to target
	const sourceAudiobooks = await db.select().from(audiobooks).where(eq(audiobooks.bookId, sourceId));
	for (const ab of sourceAudiobooks) {
		await db.update(audiobooks).set({ bookId: targetId }).where(eq(audiobooks.id, ab.id));
	}

	// Delete the source book (cascading will remove related entries)
	await deleteBook(sourceId);

	return true;
}
