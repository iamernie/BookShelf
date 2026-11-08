import { db, authors, bookAuthors, books, statuses, genres, bookSeries, series, authorTags, tags } from '$lib/server/db';
import { eq, like, sql, desc, asc, and, inArray, or, type SQL } from 'drizzle-orm';
import type { Author, NewAuthor } from '$lib/server/db/schema';
import { getBooksCardData } from './bookService';
import { viewerBooks as vub } from './personalState';
import { reachableBookCond, reachableEntityCond, canReachEntity, type Viewer } from './libraryShareService';
import { repointAndConcatEntityNotes } from './entityNotesService';
import type { BookCardData } from '$lib/types';
import { dateInAppTz } from '$lib/server/utils/appTime';
import { duplicateNameKey } from '$lib/server/utils/nameNormalization';

interface TagInfo {
	id: number;
	name: string;
	color: string | null;
	icon: string | null;
}

/**
 * Author lists, cards and detail pages are reach-scoped (2.31.0): an author shows when one of their
 * books is one the viewer can see (reachableEntityCond), and every count, cover and book list runs
 * over those books (reachableBookCond). Read counts and ratings stay the viewer's own rows.
 */

/** The viewer's own row for b, for status and rating inside the raw aggregate subqueries */
function viewerJoin(userId: number | undefined) {
	return sql`LEFT JOIN user_books vub ON vub.bookId = b.id AND vub.userId = ${userId ?? -1}`;
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

export type AuthorSort = 'name' | 'bookCount' | 'createdAt' | 'updatedAt' | 'rating' | 'progress';

export interface GetAuthorsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: AuthorSort;
	order?: 'asc' | 'desc';
	includeStats?: boolean;
	viewer?: Viewer; // Scopes the list and its figures to the books this viewer can see
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
		viewer
	} = options;
	const userId = viewer?.id;
	const offset = (page - 1) * limit;

	// Figures count the books the viewer can see
	const libCond = reachableBookCond(viewer, 'b');

	// Only authors with at least one book the viewer can see
	const hasLibraryBooks = reachableEntityCond(viewer, 'author', sql`authors.id`);

	const whereClause = search
		? and(like(authors.name, `%${search}%`), hasLibraryBooks)
		: hasLibraryBooks;

	// Get total count (same gate as the list)
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(authors)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get status IDs for stats
	const { readId, dnfId } = await getReadStatusIds();

	// sort and order are never interpolated: direction is one of two literals, the column comes from
	// the switch. Rating and Read % treat 0 as "none", matching the card and row; nulls last, id last.
	const dir = order === 'desc' ? sql`DESC` : sql`ASC`;
	const byName = sql`authors.name COLLATE NOCASE ASC`;
	let orderTerms: SQL[];
	switch (sort) {
		case 'bookCount':
			orderTerms = [sql`book_count ${dir}`, byName, sql`authors.id ASC`];
			break;
		case 'rating':
			orderTerms = [sql`NULLIF(average_rating, 0) ${dir} NULLS LAST`, byName, sql`authors.id ASC`];
			break;
		case 'progress':
			orderTerms = [sql`NULLIF(completion_percentage, 0) ${dir} NULLS LAST`, byName, sql`authors.id ASC`];
			break;
		case 'createdAt':
			orderTerms = [sql`authors.createdAt ${dir} NULLS LAST`, sql`authors.id ${dir}`];
			break;
		case 'updatedAt':
			orderTerms = [sql`authors.updatedAt ${dir} NULLS LAST`, sql`authors.id ${dir}`];
			break;
		default:
			orderTerms = [sql`authors.name COLLATE NOCASE ${dir}`, sql`authors.id ASC`];
	}

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
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND ${libCond}
			)`.as('book_count'),
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND vub.statusId = ${readId ?? 0} AND ${libCond}
			)`.as('read_count'),
			averageRating: sql<number | null>`(
				SELECT AVG(vub.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id
				AND vub.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND vub.rating IS NOT NULL
				AND ${libCond}
			)`.as('average_rating'),
			completionPercentage: sql<number>`(
				SELECT CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(SUM(CASE WHEN vub.statusId = ${readId ?? 0} THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
				END
				FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND ${libCond}
			)`.as('completion_percentage')
		})
		.from(authors)
		.where(whereClause)
		.orderBy(...orderTerms)
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

		// The books the viewer can see for these authors (cover and inferred genre)
		const authorBooks = await db
			.select({
				authorId: bookAuthors.authorId,
				bookId: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				originalCoverUrl: books.originalCoverUrl,
				rating: vub.rating,
				genreId: books.genreId
			})
			.from(bookAuthors)
			.innerJoin(books, eq(bookAuthors.bookId, books.id))
			.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
			.where(and(inArray(bookAuthors.authorId, authorIds), reachableBookCond(viewer, 'books')));

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

export async function getAuthorWithStats(id: number, viewer: Viewer): Promise<AuthorWithStats | null> {
	const userId = viewer?.id;
	const { readId, dnfId } = await getReadStatusIds();
	const libCond = reachableBookCond(viewer, 'b');

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
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND ${libCond}
			)`,
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND vub.statusId = ${readId ?? 0} AND ${libCond}
			)`,
			averageRating: sql<number | null>`(
				SELECT AVG(vub.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id
				AND vub.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND vub.rating IS NOT NULL
				AND ${libCond}
			)`,
			completionPercentage: sql<number>`(
				SELECT CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(SUM(CASE WHEN vub.statusId = ${readId ?? 0} THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
				END
				FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
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

/** Null when the author doesn't exist or has no book the viewer can see, so callers 404 alike */
export async function getAuthorWithBooks(id: number, viewer: Viewer): Promise<{
	author: AuthorWithStats;
	books: BookCardData[];
	series: {
		id: number;
		title: string;
		bookCount: number;
	}[];
} | null> {
	if (!(await canReachEntity(viewer, 'author', id))) return null;
	const userId = viewer?.id;
	const author = await getAuthorWithStats(id, viewer);
	if (!author) return null;

	const libCondition = reachableBookCond(viewer, 'books');

	// Get book IDs for this author (the books the viewer can see, ordered by title)
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
	const authorBooks = await getBooksCardData(bookIds, userId ?? null);

	// Get series for this author's books
	let authorSeries: { id: number; title: string; bookCount: number }[] = [];

	if (bookIds.length > 0) {
		// Get all series that contain this author's books listed above
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

/**
 * Author id for a name, matched by the duplicate name key so 'J.N. Chaney' reuses 'J. N. Chaney'
 * (lowest id wins, like the Audiobookshelf create path); creates the author when none matches.
 * Empty name returns null.
 */
export async function findOrCreateAuthorByName(name: string): Promise<number | null> {
	const trimmed = name.trim();
	const key = duplicateNameKey(trimmed);
	if (!key) return null;
	const rows = await db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.id));
	const existing = rows.find((r) => duplicateNameKey(r.name ?? '') === key);
	if (existing) return existing.id;
	const created = await createAuthor({ name: trimmed });
	return created.id;
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

	// One transaction: the notes must move before the delete cascades them away
	const merged = db.transaction((tx) => {
		const sourceAssociations = tx.select().from(bookAuthors).where(eq(bookAuthors.authorId, sourceId)).all();

		// Target's existing book associations, to avoid duplicates
		const targetBookIds = new Set(
			tx.select({ bookId: bookAuthors.bookId }).from(bookAuthors).where(eq(bookAuthors.authorId, targetId)).all().map((a) => a.bookId)
		);

		let moved = 0;

		// Move associations that don't exist on target
		for (const assoc of sourceAssociations) {
			const thisAssoc = and(eq(bookAuthors.authorId, sourceId), eq(bookAuthors.bookId, assoc.bookId));
			if (!targetBookIds.has(assoc.bookId)) {
				tx.update(bookAuthors).set({ authorId: targetId }).where(thisAssoc).run();
				moved++;
			} else {
				// Delete duplicate association
				tx.delete(bookAuthors).where(thisAssoc).run();
			}
		}

		// Also update legacy books.authorId if it exists
		tx.update(books).set({ authorId: targetId }).where(eq(books.authorId, sourceId)).run();

		// Every user's own notes on the source join theirs on the target
		repointAndConcatEntityNotes(tx, 'author', sourceId, targetId);

		// Delete the source author
		tx.delete(authors).where(eq(authors.id, sourceId)).run();

		return moved;
	});

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
		const normalized = duplicateNameKey(author.name);

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

	groups.forEach((authorList) => {
		if (authorList.length > 1) {
			// Filter out authors where all pairs are ignored
			const nonIgnoredAuthors = filterIgnoredPairs(authorList, ignoredPairs);
			if (nonIgnoredAuthors.length > 1) {
				// Label the group with a real name; the grouping key is not display text
				duplicates.push({ name: nonIgnoredAuthors[0].name, authors: nonIgnoredAuthors });
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
 * Export authors to CSV format: the authors of the requesting user's own library (user_books), with
 * Total Books counted over that library. Read count and average rating are the user's own.
 */
export async function exportAuthorsToCSV(userId?: number): Promise<string> {
	const { readId, dnfId } = await getReadStatusIds();
	const inLibrary = userId
		? sql`EXISTS (SELECT 1 FROM bookauthors ba JOIN user_books ub ON ub.bookId = ba.bookId
			WHERE ba.authorId = authors.id AND ub.userId = ${userId})`
		: sql`1=0`;

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
			bookCount: sql<number>`(SELECT COUNT(*) FROM bookauthors ba JOIN user_books ub ON ub.bookId = ba.bookId
				WHERE ba.authorId = authors.id AND ub.userId = ${userId ?? -1})`,
			readCount: sql<number>`(
				SELECT COUNT(*) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id AND vub.statusId = ${readId ?? 0}
			)`,
			averageRating: sql<number | null>`(
				SELECT AVG(vub.rating) FROM bookauthors ba
				JOIN books b ON ba.bookId = b.id ${viewerJoin(userId)}
				WHERE ba.authorId = authors.id
				AND vub.statusId IN (${readId ?? 0}, ${dnfId ?? 0})
				AND vub.rating IS NOT NULL
			)`
		})
		.from(authors)
		.where(inLibrary)
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
			author.createdAt ? dateInAppTz(author.createdAt) : ''
		].join(',')
	);

	return [headers.join(','), ...rows].join('\n');
}
