/**
 * API v1 Single Author Endpoint
 * Returns an author with their books
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, authors, books, bookAuthors, series, bookSeries, statuses } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const authorId = parseInt(params.id, 10);

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	if (isNaN(authorId)) {
		return json({ error: 'Invalid author ID' }, { status: 400 });
	}

	try {
		const [author] = await db.select().from(authors).where(eq(authors.id, authorId)).limit(1);

		if (!author) {
			return json({ error: 'Author not found' }, { status: 404 });
		}

		// Get all books by this author
		const authorBooks = await db.select({
			bookId: bookAuthors.bookId,
			role: bookAuthors.role,
			isPrimary: bookAuthors.isPrimary
		})
			.from(bookAuthors)
			.where(eq(bookAuthors.authorId, authorId));

		// Get book details
		const bookDetails = await Promise.all(authorBooks.map(async (ab) => {
			const [book] = await db.select().from(books).where(eq(books.id, ab.bookId)).limit(1);
			if (!book) return null;

			const [bookSeriesData, statusData] = await Promise.all([
				db.select({
					id: series.id,
					title: series.title,
					bookNum: bookSeries.bookNum
				}).from(bookSeries)
					.innerJoin(series, eq(bookSeries.seriesId, series.id))
					.where(eq(bookSeries.bookId, book.id)),
				book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				coverUrl: book.coverImageUrl,
				rating: book.rating,
				releaseDate: book.releaseDate,
				completedDate: book.completedDate,
				role: ab.role,
				isPrimary: ab.isPrimary,
				series: bookSeriesData[0] || null,
				status: statusData[0] ? {
					id: statusData[0].id,
					name: statusData[0].name,
					color: statusData[0].color
				} : null
			};
		}));

		return json({
			author: {
				id: author.id,
				name: author.name,
				bio: author.bio,
				birthDate: author.birthDate,
				deathDate: author.deathDate,
				birthPlace: author.birthPlace,
				photoUrl: author.photoUrl,
				website: author.website,
				wikipediaUrl: author.wikipediaUrl,
				comments: author.comments,
				createdAt: author.createdAt,
				updatedAt: author.updatedAt
			},
			books: bookDetails.filter(Boolean)
		});
	} catch (err) {
		console.error('API v1 author error:', err);
		return json({ error: 'Failed to fetch author' }, { status: 500 });
	}
};
