/**
 * API v1 Single Book Endpoint
 * Returns a single book with full details
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, books, authors, series, bookAuthors, bookSeries, bookTags, tags, statuses, genres, formats, narrators } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const bookId = parseInt(params.id, 10);

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
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
