import { db, authors, bookAuthors, books, statuses, genres, bookSeries, series, authorTags, tags } from '$lib/server/db';
import { eq, like, sql, desc, asc, and, inArray, or } from 'drizzle-orm';
import type { Author, NewAuthor } from '$lib/server/db/schema';
import { getBooksCardData } from './bookService';
import type { BookCardData } from '$lib/types';

interface TagInfo {
	id: number;
	name: string;
	color: string | null;
	icon: string | null;
}

/**
 * Generate SQL condition to filter books by user's library
 * User's library includes: personal books OR books user added from public library
 */
function getUserLibraryCondition(userId: number | undefined, bookTableAlias: string = 'b') {
	if (!userId) {
		// If no user, only show personal library books
		return sql.raw(`${bookTableAlias}.libraryType = 'personal'`);
	}
	return sql.raw(`(${bookTableAlias}.libraryType = 'personal' OR ${bookTableAlias}.id IN (SELECT bookId FROM user_books WHERE userId = ${userId}))`);
}

export interface AuthorWithStats extends Author {
	bookCount: number;
	readCount: number;
	averageRating: number | null;
	completionPercentage: number;
	inferredGenre?: { id: number; name: string; color: string | null } | null;
	coverBook?: { id: number; title: string; coverUrl: string | null } | null;
	tags?: TagInfo[];
}

// Legacy interface for backwards compatibility
export interface AuthorWithBookCount extends Author {
	bookCount: number;
}

export interface GetAuthorsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'name' | 'bookCount' | 'createdAt' | 'rating' | 'progress';
	order?: 'asc' | 'desc';
	includeStats?: boolean;
	userId?: number; // Filter stats to user's library (personal + added from public)
}

/**
 * Get READ and DNF status IDs for statistics calculations
 */
async function getReadStatusIds(): Promise<{ readId: number | null; dnfId: number | null }> {
	const statusList = await db
		.select({ id: statuses.id, key: statuses.key })
		.from(statuses)
		.where(inArray(statuses.key, ['READ', 'DNF']));

	return {
		readId: statusList.find((s) => s.key === 'READ')?.id ?? null,
		dnfId: statusList.find((s) => s.key === 'DNF')?.id ?? null
	};
}

export async function getAuthors(options: GetAuthorsOptions = {}): Promise<{
	items: AuthorWithStats[];
	total: number;
	page: number;
	limit: number;
}> {
	const {
		page = 1,
		limit = 24,
		search,
		sort = 'name',
		order = 'asc',
		includeStats = true,
		userId
	} = options;
	const offset = (page - 1) * limit;

	// User library condition for filtering - only show authors with books in user's library
	const libCond = getUserLibraryCondition(userId, 'b');

	// Build where clause - only authors that have books in the user's library
	const hasLibraryBooks = sql`EXISTS (
		SELECT 1 FROM bookauthors ba
		JOIN books b ON ba.bookId = b.id
		WHERE ba.authorId = authors.id AND ${libCond}
	)`;

	const whereClause = search
		? and(like(authors.name, `%${search}%`), hasLibraryBooks)
		: hasLibraryBooks;

	// Get total count (only authors with books in user's library)
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(authors)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get status IDs for stats
	const { readId, dnfId } = await getReadStatusIds();

	// Build dynamic order clause
	let orderColumn;
	switch (sort) {
		case 'bookCount':
			orderColumn = sql`book_count`;
			break;
		case 'rating':
			orderColumn = sql`average_rating`;
			break;
		case 'progress':
			orderColumn = sql`completion_percentage`;
			break;
		case 'createdAt':
			orderColumn = authors.createdAt;
			break;
		default:
			orderColumn = authors.name;
	}
	const orderDir = order === 'desc' ? desc : asc;

	// Get authors with statistics (filtered by user's library)
	const items = await db
		.select({
			id: authors.id,
			name: authors.name,
			bio: authors.bio,
			birthDate: authors.birthDate,
			deathDate: authors.deathDate,
			birthPlace: authors.birthPlace,
			photoUrl: authors.photoUrl,
			website: authors.website,
			wikipediaUrl: authors.wikipediaUrl,
			comments: authors.comments,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
			bookCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND ${libCond}
			)`.as('book_count'),
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND b.statusId = ${readId ?? 0} AND ${libCond}
			)`.as('read_count'),
			averageRating: sql<number | null>`(
				SELECT AVG(b.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id
				AND b.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND b.rating IS NOT NULL
				AND ${libCond}
			)`.as('average_rating'),
			completionPercentage: sql<number>`(
				SELECT CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(SUM(CASE WHEN b.statusId = ${readId ?? 0} THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
				END
				FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND ${libCond}
			)`.as('completion_percentage')
		})
		.from(authors)
		.where(whereClause)
		.orderBy(orderDir(orderColumn))
		.limit(limit)
		.offset(offset);

	// If stats are requested, get additional data for cover books, inferred genres, and tags
	let enrichedItems: AuthorWithStats[] = items.map((item) => ({
		...item,
		averageRating: item.averageRating ? parseFloat(item.averageRating.toFixed(2)) : null,
		completionPercentage: item.completionPercentage || 0,
		inferredGenre: null,
		coverBook: null,
		tags: []
	}));

	if (includeStats && enrichedItems.length > 0) {
		// Get cover books, inferred genres, and tags for all authors
		const authorIds = enrichedItems.map((a) => a.id);

		// Get tags for all authors
		const authorTagsData = await db
			.select({
				authorId: authorTags.authorId,
				tagId: tags.id,
				tagName: tags.name,
				tagColor: tags.color,
				tagIcon: tags.icon
			})
			.from(authorTags)
			.innerJoin(tags, eq(authorTags.tagId, tags.id))
			.where(inArray(authorTags.authorId, authorIds));

		// Group tags by authorId
		const tagsByAuthor = new Map<number, TagInfo[]>();
		for (const t of authorTagsData) {
			if (!tagsByAuthor.has(t.authorId)) {
				tagsByAuthor.set(t.authorId, []);
			}
			tagsByAuthor.get(t.authorId)!.push({
				id: t.tagId,
				name: t.tagName,
				color: t.tagColor,
				icon: t.tagIcon
			});
		}

		// Get all books for these authors
		const authorBooks = await db
			.select({
				authorId: bookAuthors.authorId,
				bookId: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				originalCoverUrl: books.originalCoverUrl,
				rating: books.rating,
				genreId: books.genreId
			})
			.from(bookAuthors)
			.innerJoin(books, eq(bookAuthors.bookId, books.id))
			.where(inArray(bookAuthors.authorId, authorIds));

		// Get all genres
		const genreList = await db.select().from(genres);
		const genreMap = new Map(genreList.map((g) => [g.id, g]));

		// Process each author
		enrichedItems = enrichedItems.map((author) => {
			const authorBookList = authorBooks.filter((b) => b.authorId === author.id);

			// Find cover book (highest rated, or first with cover)
			let coverBook: { id: number; title: string; coverUrl: string | null } | null = null;

			const ratedBooks = authorBookList
				.filter((b) => b.rating !== null && b.rating > 0)
				.sort((a, b) => (b.rating || 0) - (a.rating || 0));

			if (ratedBooks.length > 0) {
				const best = ratedBooks[0];
				const coverUrl = best.coverImageUrl || best.originalCoverUrl || null;
				if (coverUrl) {
					coverBook = { id: best.bookId, title: best.title, coverUrl };
				}
			}

			if (!coverBook) {
				for (const book of authorBookList) {
					const coverUrl = book.coverImageUrl || book.originalCoverUrl || null;
					if (coverUrl) {
						coverBook = { id: book.bookId, title: book.title, coverUrl };
						break;
					}
				}
			}

			// Infer genre from most common
			const genreCounts: Record<number, number> = {};
			authorBookList.forEach((book) => {
				if (book.genreId) {
					genreCounts[book.genreId] = (genreCounts[book.genreId] || 0) + 1;
				}
			});

			let inferredGenre: { id: number; name: string; color: string | null } | null = null;
			let maxCount = 0;
			Object.entries(genreCounts).forEach(([gId, count]) => {
				if (count > maxCount) {
					maxCount = count;
					const genre = genreMap.get(parseInt(gId));
					if (genre) {
						inferredGenre = { id: genre.id, name: genre.name, color: genre.color };
					}
				}
			});

			return {
				...author,
				coverBook,
				inferredGenre,
				tags: tagsByAuthor.get(author.id) || []
			};
		});
	}

	return {
		items: enrichedItems,
		total,
		page,
		limit
	};
}

export async function getAuthorById(id: number): Promise<Author | null> {
	const result = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
	return result[0] || null;
}

export async function getAuthorWithStats(id: number, userId?: number): Promise<AuthorWithStats | null> {
	const { readId, dnfId } = await getReadStatusIds();
	const libCond = getUserLibraryCondition(userId, 'b');

	const result = await db
		.select({
			id: authors.id,
			name: authors.name,
			bio: authors.bio,
			birthDate: authors.birthDate,
			deathDate: authors.deathDate,
			birthPlace: authors.birthPlace,
			photoUrl: authors.photoUrl,
			website: authors.website,
			wikipediaUrl: authors.wikipediaUrl,
			comments: authors.comments,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
			bookCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND ${libCond}
			)`,
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND b.statusId = ${readId ?? 0} AND ${libCond}
			)`,
			averageRating: sql<number | null>`(
				SELECT AVG(b.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id
				AND b.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND b.rating IS NOT NULL
				AND ${libCond}
			)`,
			completionPercentage: sql<number>`(
				SELECT CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(SUM(CASE WHEN b.statusId = ${readId ?? 0} THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
				END
				FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND ${libCond}
			)`
		})
		.from(authors)
		.where(eq(authors.id, id))
		.limit(1);

	if (!result[0]) return null;

	return {
		...result[0],
		averageRating: result[0].averageRating
			? parseFloat(result[0].averageRating.toFixed(2))
			: null,
		completionPercentage: result[0].completionPercentage || 0
	};
}

export async function getAuthorWithBooks(id: number, userId?: number): Promise<{
	author: AuthorWithStats;
	books: BookCardData[];
	series: {
		id: number;
		title: string;
		bookCount: number;
	}[];
} | null> {
	const author = await getAuthorWithStats(id, userId);
	if (!author) return null;

	// Build library condition for filtering
	const libCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Get book IDs for this author (filtered by user's library, ordered by title)
	const authorBookIds = await db
		.select({
			id: books.id,
			title: books.title
		})
		.from(books)
		.innerJoin(bookAuthors, eq(books.id, bookAuthors.bookId))
		.where(and(eq(bookAuthors.authorId, id), libCondition))
		.orderBy(books.title);

	const bookIds = authorBookIds.map((b) => b.id);

	// Get full book card data using the shared helper
	const authorBooks = await getBooksCardData(bookIds);

	// Get series for this author's books
	let authorSeries: { id: number; title: string; bookCount: number }[] = [];

	if (bookIds.length > 0) {
		// Get all series that contain books by this author (in user's library)
		const seriesData = await db
			.select({
				id: series.id,
				title: series.title,
				bookCount: sql<number>`COUNT(DISTINCT ${bookSeries.bookId})`
			})
			.from(series)
			.innerJoin(bookSeries, eq(series.id, bookSeries.seriesId))
			.where(inArray(bookSeries.bookId, bookIds))
			.groupBy(series.id, series.title)
			.orderBy(series.title);

		authorSeries = seriesData;
	}

	return { author, books: authorBooks, series: authorSeries };
}

export async function createAuthor(data: NewAuthor): Promise<Author> {
	const now = new Date().toISOString();
	const [newAuthor] = await db
		.insert(authors)
		.values({
			...data,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return newAuthor;
}

export async function updateAuthor(id: number, data: Partial<NewAuthor>): Promise<Author | null> {
	const now = new Date().toISOString();
	const [updated] = await db
		.update(authors)
		.set({
			...data,
			updatedAt: now
		})
		.where(eq(authors.id, id))
		.returning();
	return updated || null;
}

export async function deleteAuthor(id: number): Promise<boolean> {
	const result = await db.delete(authors).where(eq(authors.id, id));
	return result.changes > 0;
}

/**
 * Merge duplicate authors
 * Moves all book associations from sourceId to targetId, then deletes sourceId
 */
export async function mergeAuthors(
	targetId: number,
	sourceId: number
): Promise<{ success: boolean; merged: number; error?: string }> {
	const target = await getAuthorById(targetId);
	const source = await getAuthorById(sourceId);

	if (!target) {
		return { success: false, merged: 0, error: 'Target author not found' };
	}
	if (!source) {
		return { success: false, merged: 0, error: 'Source author not found' };
	}
	if (targetId === sourceId) {
		return { success: false, merged: 0, error: 'Cannot merge author with itself' };
	}

	// Get all book associations for the source author
	const sourceAssociations = await db
		.select()
		.from(bookAuthors)
		.where(eq(bookAuthors.authorId, sourceId));

	// Get target's existing book associations to avoid duplicates
	const targetAssociations = await db
		.select()
		.from(bookAuthors)
		.where(eq(bookAuthors.authorId, targetId));

	const targetBookIds = new Set(targetAssociations.map((a) => a.bookId));

	let merged = 0;

	// Move associations that don't exist on target
	for (const assoc of sourceAssociations) {
		if (!targetBookIds.has(assoc.bookId)) {
			await db
				.update(bookAuthors)
				.set({ authorId: targetId })
				.where(and(eq(bookAuthors.authorId, sourceId), eq(bookAuthors.bookId, assoc.bookId)));
			merged++;
		} else {
			// Delete duplicate association
			await db
				.delete(bookAuthors)
				.where(and(eq(bookAuthors.authorId, sourceId), eq(bookAuthors.bookId, assoc.bookId)));
		}
	}

	// Also update legacy books.authorId if it exists
	await db.update(books).set({ authorId: targetId }).where(eq(books.authorId, sourceId));

	// Delete the source author
	await db.delete(authors).where(eq(authors.id, sourceId));

	return { success: true, merged };
}

/**
 * Find potential duplicate authors
 */
export async function findDuplicateAuthors(): Promise<
	Array<{ name: string; authors: { id: number; name: string; bookCount: number }[] }>
> {
	// Get ignored pairs
	const { getIgnoredPairs } = await import('./ignoredDuplicatesService');
	const ignoredPairs = await getIgnoredPairs('author');

	// Get all authors with similar names (case-insensitive)
	const allAuthors = await db
		.select({
			id: authors.id,
			name: authors.name,
			bookCount:
				sql<number>`(SELECT COUNT(*) FROM bookauthors WHERE bookauthors.authorId = authors.id)`
		})
		.from(authors)
		.orderBy(authors.name);

	// Group by normalized name
	const groups = new Map<string, Array<{ id: number; name: string; bookCount: number }>>();

	for (const author of allAuthors) {
		// Normalize: lowercase, remove extra spaces, common variations
		const normalized = author.name
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.replace(/\./g, '')
			.trim();

		if (!groups.has(normalized)) {
			groups.set(normalized, []);
		}
		groups.get(normalized)!.push(author);
	}

	// Return only groups with duplicates, filtering out ignored pairs
	const duplicates: Array<{
		name: string;
		authors: { id: number; name: string; bookCount: number }[];
	}> = [];

	groups.forEach((authorList, name) => {
		if (authorList.length > 1) {
			// Filter out authors where all pairs are ignored
			const nonIgnoredAuthors = filterIgnoredPairs(authorList, ignoredPairs);
			if (nonIgnoredAuthors.length > 1) {
				duplicates.push({ name, authors: nonIgnoredAuthors });
			}
		}
	});

	return duplicates;
}

/**
 * Filter out items where all pairs in the group are ignored
 */
function filterIgnoredPairs<T extends { id: number }>(items: T[], ignoredPairs: Set<string>): T[] {
	if (items.length <= 1) return items;

	// Check if ALL pairs in this group are ignored
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

	// If all pairs are ignored, return empty (don't show this group)
	if (!hasNonIgnoredPair) {
		return [];
	}

	return items;
}

/**
 * Export authors to CSV format
 */
export async function exportAuthorsToCSV(): Promise<string> {
	const { readId, dnfId } = await getReadStatusIds();

	const authorData = await db
		.select({
			id: authors.id,
			name: authors.name,
			comments: authors.comments,
			bio: authors.bio,
			birthDate: authors.birthDate,
			deathDate: authors.deathDate,
			website: authors.website,
			wikipediaUrl: authors.wikipediaUrl,
			createdAt: authors.createdAt,
			bookCount: sql<number>`(SELECT COUNT(*) FROM bookauthors WHERE bookauthors.authorId = authors.id)`,
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id AND b.statusId = ${readId ?? 0}
			)`,
			averageRating: sql<number | null>`(
				SELECT AVG(b.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id
				WHERE ba.authorId = authors.id
				AND b.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND b.rating IS NOT NULL
			)`
		})
		.from(authors)
		.orderBy(authors.name);

	const headers = [
		'Name',
		'Comments',
		'Bio',
		'Birth Date',
		'Death Date',
		'Website',
		'Wikipedia URL',
		'Total Books',
		'Books Read',
		'Average Rating',
		'Date Added'
	];

	const escapeCSV = (str: string | null | undefined): string => {
		if (!str) return '';
		const stringValue = String(str);
		if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		return stringValue;
	};

	const rows = authorData.map((author) =>
		[
			escapeCSV(author.name),
			escapeCSV(author.comments),
			escapeCSV(author.bio),
			author.birthDate || '',
			author.deathDate || '',
			escapeCSV(author.website),
			escapeCSV(author.wikipediaUrl),
			author.bookCount || 0,
			author.readCount || 0,
			author.averageRating ? author.averageRating.toFixed(2) : '',
			author.createdAt ? author.createdAt.split('T')[0] : ''
		].join(',')
	);

	return [headers.join(','), ...rows].join('\n');
}
