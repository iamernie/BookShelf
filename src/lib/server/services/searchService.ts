import { db, books, authors, series, narrators, bookAuthors, bookSeries, statuses, genres, formats, tags, bookTags, userBooks } from '$lib/server/db';
import { like, eq, sql, asc, desc, and, or, gte, lte, ne, isNull, isNotNull, inArray } from 'drizzle-orm';
import { personalCols, overlayPersonal, viewerBooks as vub } from './personalState';
import { reachableBookCond, reachableEntityCond, type Viewer } from './libraryShareService';

export interface AutocompleteResult {
	books: {
		id: number;
		title: string;
		coverImageUrl: string | null;
		author: string | null;
		series: string | null;
		type: 'book';
		url: string;
	}[];
	authors: {
		id: number;
		name: string;
		type: 'author';
		url: string;
	}[];
	series: {
		id: number;
		title: string;
		type: 'series';
		url: string;
	}[];
	narrators: {
		id: number;
		name: string;
		type: 'narrator';
		url: string;
	}[];
}

/** Books the viewer can see; author, series and narrator names through the entity gate */
export async function autocomplete(query: string, viewer: Viewer): Promise<AutocompleteResult> {
	if (!query || query.length < 2) {
		return { books: [], authors: [], series: [], narrators: [] };
	}

	const searchTerm = `%${query}%`;

	// Run all searches in parallel
	const [booksResult, authorsResult, seriesResult, narratorsResult] = await Promise.all([
		// Search books by title (the ones the viewer can see)
		db.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
			.from(books)
			.where(and(like(books.title, searchTerm), reachableBookCond(viewer)))
			.orderBy(asc(books.title))
			.limit(5),

		// Search authors by name
		db.select({
			id: authors.id,
			name: authors.name
		})
			.from(authors)
			.where(and(like(authors.name, searchTerm), reachableEntityCond(viewer, 'author', sql`${authors.id}`)))
			.orderBy(asc(authors.name))
			.limit(5),

		// Search series by title
		db.select({
			id: series.id,
			title: series.title
		})
			.from(series)
			.where(and(like(series.title, searchTerm), reachableEntityCond(viewer, 'series', sql`${series.id}`)))
			.orderBy(asc(series.title))
			.limit(5),

		// Search narrators by name
		db.select({
			id: narrators.id,
			name: narrators.name
		})
			.from(narrators)
			.where(and(like(narrators.name, searchTerm), reachableEntityCond(viewer, 'narrator', sql`${narrators.id}`)))
			.orderBy(asc(narrators.name))
			.limit(5)
	]);

	// Get author and series info for books
	const booksWithRelations = await Promise.all(
		booksResult.map(async (book) => {
			const [authorData, seriesData] = await Promise.all([
				db.select({ name: authors.name })
					.from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(and(eq(bookAuthors.bookId, book.id), eq(bookAuthors.isPrimary, true)))
					.limit(1),
				db.select({ title: series.title })
					.from(bookSeries)
					.innerJoin(series, eq(bookSeries.seriesId, series.id))
					.where(and(eq(bookSeries.bookId, book.id), eq(bookSeries.isPrimary, true)))
					.limit(1)
			]);

			return {
				id: book.id,
				title: book.title,
				coverImageUrl: book.coverImageUrl,
				author: authorData[0]?.name || null,
				series: seriesData[0]?.title || null,
				type: 'book' as const,
				url: `/books/${book.id}`
			};
		})
	);

	return {
		books: booksWithRelations,
		authors: authorsResult.map(a => ({
			id: a.id,
			name: a.name,
			type: 'author' as const,
			url: `/authors/${a.id}`
		})),
		series: seriesResult.map(s => ({
			id: s.id,
			title: s.title,
			type: 'series' as const,
			url: `/series/${s.id}`
		})),
		narrators: narratorsResult.map(n => ({
			id: n.id,
			name: n.name,
			type: 'narrator' as const,
			url: `/narrators/${n.id}`
		}))
	};
}

export interface AdvancedSearchFilters {
	// Text filters
	title?: string;
	authorName?: string;
	seriesTitle?: string;
	summaryComments?: string;

	// ID filters
	statusId?: number;
	genreId?: number;
	formatId?: number;
	seriesId?: number;
	tagIds?: number[];

	// Range filters
	ratingMin?: number;
	ratingMax?: number;
	pagesMin?: number;
	pagesMax?: number;
	completedFrom?: string;
	completedTo?: string;
	releaseFrom?: string;
	releaseTo?: string;

	// Boolean filters
	hasNarrator?: boolean;
	hasRating?: boolean;
	noRating?: boolean;
	hasCover?: boolean;
	noCover?: boolean;

	// Sorting
	sortBy?: 'title' | 'title_desc' | 'rating' | 'rating_asc' | 'completedDate' | 'releaseDate' | 'dateAdded' | 'pages';

	// Pagination
	page?: number;
	limit?: number;
}

export interface AdvancedSearchBook {
	id: number;
	title: string;
	coverImageUrl: string | null;
	rating: number | null;
	pageCount: number | null;
	completedDate: string | null;
	releaseDate: string | null;
	authors: { id: number; name: string }[];
	series: { id: number; title: string; bookNum: number | null }[];
	status: { id: number; name: string; color: string | null; icon: string | null } | null;
	genre: { id: number; name: string } | null;
	format: { id: number; name: string } | null;
	narrator: { id: number; name: string } | null;
	tags: { id: number; name: string; color: string | null }[];
}

export interface AdvancedSearchResult {
	items: AdvancedSearchBook[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

/** Searches the books the viewer can see (reachableBookCond) */
export async function advancedSearch(filters: AdvancedSearchFilters, viewer: Viewer): Promise<AdvancedSearchResult> {
	const { page = 1, limit = 24 } = filters;
	const userId = viewer?.id;
	const offset = (page - 1) * limit;

	// Notes, status, rating and completed date are the viewer's own row (vub)
	const personal = personalCols(userId);

	// Build where conditions
	const conditions: ReturnType<typeof eq>[] = [];

	// Only books the viewer can see
	conditions.push(reachableBookCond(viewer));

	// Title search
	if (filters.title) {
		conditions.push(like(books.title, `%${filters.title}%`));
	}

	// Summary/Comments search
	if (filters.summaryComments) {
		const term = `%${filters.summaryComments}%`;
		conditions.push(
			or(
				like(books.summary, term),
				like(vub.comments, term)
			)!
		);
	}

	// Status filter
	if (filters.statusId) {
		conditions.push(eq(vub.statusId, filters.statusId));
	}

	// Genre filter
	if (filters.genreId) {
		conditions.push(eq(books.genreId, filters.genreId));
	}

	// Format filter
	if (filters.formatId) {
		conditions.push(eq(books.formatId, filters.formatId));
	}

	// Rating range
	if (filters.ratingMin !== undefined) {
		conditions.push(gte(vub.rating, filters.ratingMin));
	}
	if (filters.ratingMax !== undefined) {
		conditions.push(lte(vub.rating, filters.ratingMax));
	}

	// Page count range
	if (filters.pagesMin !== undefined) {
		conditions.push(gte(books.pageCount, filters.pagesMin));
	}
	if (filters.pagesMax !== undefined) {
		conditions.push(lte(books.pageCount, filters.pagesMax));
	}

	// Date ranges
	if (filters.completedFrom) {
		conditions.push(gte(vub.completedDate, filters.completedFrom));
	}
	if (filters.completedTo) {
		conditions.push(lte(vub.completedDate, filters.completedTo));
	}
	if (filters.releaseFrom) {
		conditions.push(gte(books.releaseDate, filters.releaseFrom));
	}
	if (filters.releaseTo) {
		conditions.push(lte(books.releaseDate, filters.releaseTo));
	}

	// Boolean filters
	if (filters.hasNarrator) {
		conditions.push(isNotNull(books.narratorId));
	}
	if (filters.hasRating) {
		conditions.push(and(isNotNull(vub.rating), gte(vub.rating, 0.1))!);
	}
	if (filters.noRating) {
		conditions.push(or(isNull(vub.rating), eq(vub.rating, 0))!);
	}
	if (filters.hasCover) {
		conditions.push(and(isNotNull(books.coverImageUrl), ne(books.coverImageUrl, ''))!);
	}
	if (filters.noCover) {
		conditions.push(or(isNull(books.coverImageUrl), eq(books.coverImageUrl, ''))!);
	}

	// Author name filter - need to find matching book IDs first
	if (filters.authorName) {
		const authorBookIds = await db
			.selectDistinct({ bookId: bookAuthors.bookId })
			.from(bookAuthors)
			.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
			.where(like(authors.name, `%${filters.authorName}%`));

		if (authorBookIds.length > 0) {
			conditions.push(inArray(books.id, authorBookIds.map(b => b.bookId)));
		} else {
			// No matching authors, return empty
			return { items: [], total: 0, page, limit, totalPages: 0 };
		}
	}

	// Series title filter
	if (filters.seriesTitle) {
		const seriesBookIds = await db
			.selectDistinct({ bookId: bookSeries.bookId })
			.from(bookSeries)
			.innerJoin(series, eq(bookSeries.seriesId, series.id))
			.where(like(series.title, `%${filters.seriesTitle}%`));

		if (seriesBookIds.length > 0) {
			conditions.push(inArray(books.id, seriesBookIds.map(b => b.bookId)));
		} else {
			return { items: [], total: 0, page, limit, totalPages: 0 };
		}
	}

	// Series ID filter
	if (filters.seriesId) {
		const seriesBookIds = await db
			.select({ bookId: bookSeries.bookId })
			.from(bookSeries)
			.where(eq(bookSeries.seriesId, filters.seriesId));

		if (seriesBookIds.length > 0) {
			conditions.push(inArray(books.id, seriesBookIds.map(b => b.bookId)));
		} else {
			return { items: [], total: 0, page, limit, totalPages: 0 };
		}
	}

	// Tag filter - books must have ALL selected tags
	if (filters.tagIds && filters.tagIds.length > 0) {
		for (const tagId of filters.tagIds) {
			const tagBookIds = await db
				.select({ bookId: bookTags.bookId })
				.from(bookTags)
				.where(eq(bookTags.tagId, tagId));

			if (tagBookIds.length > 0) {
				conditions.push(inArray(books.id, tagBookIds.map(b => b.bookId)));
			} else {
				return { items: [], total: 0, page, limit, totalPages: 0 };
			}
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.leftJoin(personal.table, personal.on)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;
	const totalPages = Math.ceil(total / limit);

	// Sort order
	let orderClause;
	switch (filters.sortBy) {
		case 'title_desc':
			orderClause = desc(books.title);
			break;
		case 'rating':
			orderClause = desc(vub.rating);
			break;
		case 'rating_asc':
			orderClause = asc(vub.rating);
			break;
		case 'completedDate':
			orderClause = desc(vub.completedDate);
			break;
		case 'releaseDate':
			orderClause = desc(books.releaseDate);
			break;
		case 'dateAdded':
			orderClause = desc(books.createdAt);
			break;
		case 'pages':
			orderClause = desc(books.pageCount);
			break;
		case 'title':
		default:
			orderClause = asc(books.title);
			break;
	}

	// Get books
	const booksList = await overlayPersonal((await db
		.select({ book: books })
		.from(books)
		.leftJoin(personal.table, personal.on)
		.where(whereClause)
		.orderBy(orderClause)
		.limit(limit)
		.offset(offset)).map((r) => r.book), userId);

	// Fetch relations for each book
	const items = await Promise.all(
		booksList.map(async (book) => {
			const [authorData, seriesData, tagData, statusData, genreData, formatData, narratorData] = await Promise.all([
				db.select({
					id: authors.id,
					name: authors.name
				})
					.from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(eq(bookAuthors.bookId, book.id))
					.orderBy(asc(bookAuthors.displayOrder)),

				db.select({
					id: series.id,
					title: series.title,
					bookNum: bookSeries.bookNum
				})
					.from(bookSeries)
					.innerJoin(series, eq(bookSeries.seriesId, series.id))
					.where(eq(bookSeries.bookId, book.id))
					.orderBy(asc(bookSeries.displayOrder)),

				db.select({
					id: tags.id,
					name: tags.name,
					color: tags.color
				})
					.from(bookTags)
					.innerJoin(tags, eq(bookTags.tagId, tags.id))
					.where(eq(bookTags.bookId, book.id)),

				book.statusId
					? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1)
					: Promise.resolve([]),

				book.genreId
					? db.select().from(genres).where(eq(genres.id, book.genreId)).limit(1)
					: Promise.resolve([]),

				book.formatId
					? db.select().from(formats).where(eq(formats.id, book.formatId)).limit(1)
					: Promise.resolve([]),

				book.narratorId
					? db.select().from(narrators).where(eq(narrators.id, book.narratorId)).limit(1)
					: Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				coverImageUrl: book.coverImageUrl,
				rating: book.rating,
				pageCount: book.pageCount,
				completedDate: book.completedDate,
				releaseDate: book.releaseDate,
				authors: authorData,
				series: seriesData,
				tags: tagData,
				status: statusData[0] ? { id: statusData[0].id, name: statusData[0].name, color: statusData[0].color, icon: statusData[0].icon } : null,
				genre: genreData[0] ? { id: genreData[0].id, name: genreData[0].name } : null,
				format: formatData[0] ? { id: formatData[0].id, name: formatData[0].name } : null,
				narrator: narratorData[0] ? { id: narratorData[0].id, name: narratorData[0].name } : null
			};
		})
	);

	return { items, total, page, limit, totalPages };
}

// Get all filter options for the advanced search form; the series list is the viewer's reachable series
export async function getSearchOptions(viewer: Viewer) {
	const [statusList, genreList, formatList, seriesList, tagList] = await Promise.all([
		db.select().from(statuses).orderBy(asc(statuses.sortOrder)),
		db.select().from(genres).orderBy(asc(genres.name)),
		db.select().from(formats).orderBy(asc(formats.name)),
		db.select({ id: series.id, title: series.title }).from(series).where(reachableEntityCond(viewer, 'series', sql`${series.id}`)).orderBy(asc(series.title)),
		db.select().from(tags).orderBy(asc(tags.name))
	]);

	return {
		statuses: statusList,
		genres: genreList,
		formats: formatList,
		series: seriesList,
		tags: tagList
	};
}
