/**
 * API v1 Books Endpoint
 * Returns all books with full details
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, books, authors, series, bookAuthors, bookSeries, bookTags, tags, statuses, genres, formats, narrators } from '$lib/server/db';
import { eq, sql, desc, and, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const statusFilter = url.searchParams.get('status');
	const genreFilter = url.searchParams.get('genre');
	const authorFilter = url.searchParams.get('author');
	const seriesFilter = url.searchParams.get('series');

	try {
		// Build conditions
		const conditions = [];

		if (statusFilter) {
			const status = await db.select({ id: statuses.id })
				.from(statuses)
				.where(sql`LOWER(${statuses.name}) = LOWER(${statusFilter})`)
				.limit(1);
			if (status[0]) {
				conditions.push(eq(books.statusId, status[0].id));
			}
		}

		if (genreFilter) {
			const genre = await db.select({ id: genres.id })
				.from(genres)
				.where(sql`LOWER(${genres.name}) = LOWER(${genreFilter})`)
				.limit(1);
			if (genre[0]) {
				conditions.push(eq(books.genreId, genre[0].id));
			}
		}

		if (authorFilter) {
			const authorId = parseInt(authorFilter, 10);
			const bookIdsWithAuthor = await db.select({ bookId: bookAuthors.bookId })
				.from(bookAuthors)
				.where(eq(bookAuthors.authorId, authorId));
			if (bookIdsWithAuthor.length > 0) {
				conditions.push(inArray(books.id, bookIdsWithAuthor.map(b => b.bookId)));
			}
		}

		if (seriesFilter) {
			const seriesId = parseInt(seriesFilter, 10);
			const bookIdsInSeries = await db.select({ bookId: bookSeries.bookId })
				.from(bookSeries)
				.where(eq(bookSeries.seriesId, seriesId));
			if (bookIdsInSeries.length > 0) {
				conditions.push(inArray(books.id, bookIdsInSeries.map(b => b.bookId)));
			}
		}

		// Get total count
		const [countResult] = conditions.length > 0
			? await db.select({ count: sql<number>`count(*)` }).from(books).where(and(...conditions))
			: await db.select({ count: sql<number>`count(*)` }).from(books);

		// Get books
		const booksList = conditions.length > 0
			? await db.select().from(books).where(and(...conditions)).orderBy(desc(books.updatedAt)).limit(limit).offset(offset)
			: await db.select().from(books).orderBy(desc(books.updatedAt)).limit(limit).offset(offset);

		// Fetch all relations in parallel for each book
		const booksWithDetails = await Promise.all(booksList.map(async (book) => {
			const [bookAuthorsData, bookSeriesData, bookTagsData, statusData, genreData, formatData, narratorData] = await Promise.all([
				db.select({
					id: authors.id,
					name: authors.name,
					photoUrl: authors.photoUrl,
					role: bookAuthors.role,
					isPrimary: bookAuthors.isPrimary
				}).from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(eq(bookAuthors.bookId, book.id)),
				db.select({
					id: series.id,
					title: series.title,
					bookNum: bookSeries.bookNum,
					bookNumEnd: bookSeries.bookNumEnd
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
				book.narratorId ? db.select().from(narrators).where(eq(narrators.id, book.narratorId)).limit(1) : Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				summary: book.summary,
				comments: book.comments,
				coverUrl: book.coverImageUrl,
				rating: book.rating,
				pageCount: book.pageCount,
				releaseDate: book.releaseDate,
				startReadingDate: book.startReadingDate,
				completedDate: book.completedDate,
				isbn10: book.isbn10,
				isbn13: book.isbn13,
				asin: book.asin,
				goodreadsId: book.goodreadsId,
				googleBooksId: book.googleBooksId,
				publisher: book.publisher,
				publishYear: book.publishYear,
				language: book.language,
				edition: book.edition,
				ebookPath: book.ebookPath ? true : false, // Don't expose actual path
				ebookFormat: book.ebookFormat,
				hasEbook: !!book.ebookPath,
				authors: bookAuthorsData.map(a => ({
					id: a.id,
					name: a.name,
					photoUrl: a.photoUrl,
					role: a.role,
					isPrimary: a.isPrimary
				})),
				series: bookSeriesData.map(s => ({
					id: s.id,
					title: s.title,
					bookNum: s.bookNum,
					bookNumEnd: s.bookNumEnd
				})),
				tags: bookTagsData,
				status: statusData[0] ? {
					id: statusData[0].id,
					name: statusData[0].name,
					color: statusData[0].color,
					icon: statusData[0].icon
				} : null,
				genre: genreData[0] ? {
					id: genreData[0].id,
					name: genreData[0].name,
					color: genreData[0].color
				} : null,
				format: formatData[0] ? {
					id: formatData[0].id,
					name: formatData[0].name,
					color: formatData[0].color,
					icon: formatData[0].icon
				} : null,
				narrator: narratorData[0] ? {
					id: narratorData[0].id,
					name: narratorData[0].name,
					photoUrl: narratorData[0].photoUrl
				} : null,
				createdAt: book.createdAt,
				updatedAt: book.updatedAt
			};
		}));

		return json({
			books: booksWithDetails,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 books error:', err);
		return json({ error: 'Failed to fetch books' }, { status: 500 });
	}
};
