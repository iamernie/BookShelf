/**
 * API v1 Single Book Endpoint
 * GET, PUT, DELETE operations for a single book
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { updateBook, deleteBook, type CreateBookData } from '$lib/server/services/bookService';
import { db, books, authors, series, bookAuthors, bookSeries, bookTags, tags, statuses, genres, formats, narrators } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';

// Helper to validate token and check API enabled
async function validateRequest(token: string | null): Promise<{ valid: boolean; error?: string; status?: number }> {
	if (!(await areWidgetsEnabled())) {
		return { valid: false, error: 'API is disabled', status: 403 };
	}
	if (!token || !(await validateWidgetToken(token))) {
		return { valid: false, error: 'Invalid or missing API token', status: 401 };
	}
	return { valid: true };
}

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const bookId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(bookId)) {
		return json({ error: 'Invalid book ID' }, { status: 400 });
	}

	try {
		const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

		if (!book) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		const [bookAuthorsData, bookSeriesData, bookTagsData, statusData, genreData, formatData, narratorData] = await Promise.all([
			db.select({
				id: authors.id,
				name: authors.name,
				photoUrl: authors.photoUrl,
				bio: authors.bio,
				role: bookAuthors.role,
				isPrimary: bookAuthors.isPrimary
			}).from(bookAuthors)
				.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
				.where(eq(bookAuthors.bookId, bookId)),
			db.select({
				id: series.id,
				title: series.title,
				description: series.description,
				bookNum: bookSeries.bookNum,
				bookNumEnd: bookSeries.bookNumEnd
			}).from(bookSeries)
				.innerJoin(series, eq(bookSeries.seriesId, series.id))
				.where(eq(bookSeries.bookId, bookId)),
			db.select({
				id: tags.id,
				name: tags.name,
				color: tags.color,
				icon: tags.icon
			}).from(bookTags)
				.innerJoin(tags, eq(bookTags.tagId, tags.id))
				.where(eq(bookTags.bookId, bookId)),
			book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([]),
			book.genreId ? db.select().from(genres).where(eq(genres.id, book.genreId)).limit(1) : Promise.resolve([]),
			book.formatId ? db.select().from(formats).where(eq(formats.id, book.formatId)).limit(1) : Promise.resolve([]),
			book.narratorId ? db.select().from(narrators).where(eq(narrators.id, book.narratorId)).limit(1) : Promise.resolve([])
		]);

		return json({
			book: {
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
				providerRating: book.providerRating,
				providerRatingSource: book.providerRatingSource,
				providerRatingCount: book.providerRatingCount,
				publisher: book.publisher,
				publishYear: book.publishYear,
				language: book.language,
				edition: book.edition,
				purchasePrice: book.purchasePrice,
				dnfPage: book.dnfPage,
				dnfPercent: book.dnfPercent,
				dnfReason: book.dnfReason,
				dnfDate: book.dnfDate,
				ebookFormat: book.ebookFormat,
				hasEbook: !!book.ebookPath,
				lastReadAt: book.lastReadAt,
				authors: bookAuthorsData.map(a => ({
					id: a.id,
					name: a.name,
					photoUrl: a.photoUrl,
					bio: a.bio,
					role: a.role,
					isPrimary: a.isPrimary
				})),
				series: bookSeriesData.map(s => ({
					id: s.id,
					title: s.title,
					description: s.description,
					bookNum: s.bookNum,
					bookNumEnd: s.bookNumEnd
				})),
				tags: bookTagsData,
				status: statusData[0] ? {
					id: statusData[0].id,
					name: statusData[0].name,
					key: statusData[0].key,
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
			}
		});
	} catch (err) {
		console.error('API v1 book error:', err);
		return json({ error: 'Failed to fetch book' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/books/[id] - Update a book
 */
export const PUT: RequestHandler = async ({ params, url, request }) => {
	const token = url.searchParams.get('token');
	const bookId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(bookId)) {
		return json({ error: 'Invalid book ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		// Check book exists
		const [existingBook] = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId)).limit(1);
		if (!existingBook) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		// Look up status by name if provided
		let statusId = body.statusId;
		if (body.status && !statusId) {
			const [status] = await db.select({ id: statuses.id })
				.from(statuses)
				.where(sql`LOWER(${statuses.name}) = LOWER(${body.status})`)
				.limit(1);
			statusId = status?.id;
		}

		// Look up genre by name if provided
		let genreId = body.genreId;
		if (body.genre && !genreId) {
			const [genre] = await db.select({ id: genres.id })
				.from(genres)
				.where(sql`LOWER(${genres.name}) = LOWER(${body.genre})`)
				.limit(1);
			genreId = genre?.id;
		}

		// Look up format by name if provided
		let formatId = body.formatId;
		if (body.format && !formatId) {
			const [format] = await db.select({ id: formats.id })
				.from(formats)
				.where(sql`LOWER(${formats.name}) = LOWER(${body.format})`)
				.limit(1);
			formatId = format?.id;
		}

		const updateData: Partial<CreateBookData> = {};

		// Only include fields that are explicitly provided
		if (body.title !== undefined) updateData.title = body.title;
		if (body.summary !== undefined) updateData.summary = body.summary;
		if (body.comments !== undefined) updateData.comments = body.comments;
		if (body.coverUrl !== undefined) updateData.coverImageUrl = body.coverUrl;
		if (body.rating !== undefined) updateData.rating = body.rating;
		if (body.pageCount !== undefined) updateData.pageCount = body.pageCount;
		if (body.releaseDate !== undefined) updateData.releaseDate = body.releaseDate;
		if (body.startReadingDate !== undefined) updateData.startReadingDate = body.startReadingDate;
		if (body.completedDate !== undefined) updateData.completedDate = body.completedDate;
		if (body.isbn10 !== undefined) updateData.isbn10 = body.isbn10;
		if (body.isbn13 !== undefined) updateData.isbn13 = body.isbn13;
		if (body.asin !== undefined) updateData.asin = body.asin;
		if (body.goodreadsId !== undefined) updateData.goodreadsId = body.goodreadsId;
		if (body.googleBooksId !== undefined) updateData.googleBooksId = body.googleBooksId;
		if (body.publisher !== undefined) updateData.publisher = body.publisher;
		if (body.publishYear !== undefined) updateData.publishYear = body.publishYear;
		if (body.language !== undefined) updateData.language = body.language;
		if (body.edition !== undefined) updateData.edition = body.edition;
		if (statusId !== undefined) updateData.statusId = statusId;
		if (genreId !== undefined) updateData.genreId = genreId;
		if (formatId !== undefined) updateData.formatId = formatId;
		if (body.authors !== undefined) updateData.authors = body.authors;
		if (body.series !== undefined) updateData.series = body.series;
		if (body.tagIds !== undefined) updateData.tagIds = body.tagIds;

		const updatedBook = await updateBook(bookId, updateData);

		if (!updatedBook) {
			return json({ error: 'Failed to update book' }, { status: 500 });
		}

		return json({
			book: { id: updatedBook.id, title: updatedBook.title },
			message: 'Book updated successfully'
		});
	} catch (err) {
		console.error('API v1 update book error:', err);
		return json({ error: 'Failed to update book' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/books/[id] - Delete a book
 */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const bookId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(bookId)) {
		return json({ error: 'Invalid book ID' }, { status: 400 });
	}

	try {
		// Check book exists
		const [existingBook] = await db.select({ id: books.id, title: books.title }).from(books).where(eq(books.id, bookId)).limit(1);
		if (!existingBook) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		const deleted = await deleteBook(bookId);

		if (!deleted) {
			return json({ error: 'Failed to delete book' }, { status: 500 });
		}

		return json({
			message: `Book "${existingBook.title}" deleted successfully`
		});
	} catch (err) {
		console.error('API v1 delete book error:', err);
		return json({ error: 'Failed to delete book' }, { status: 500 });
	}
};
