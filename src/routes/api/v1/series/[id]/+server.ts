/**
 * API v1 Single Series Endpoint
 * GET, PUT, DELETE operations for a single series
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { updateSeries, deleteSeries } from '$lib/server/services/seriesService';
import { db, series, books, bookSeries, authors, bookAuthors, statuses } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';

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
	const seriesId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(seriesId)) {
		return json({ error: 'Invalid series ID' }, { status: 400 });
	}

	try {
		const [seriesData] = await db.select().from(series).where(eq(series.id, seriesId)).limit(1);

		if (!seriesData) {
			return json({ error: 'Series not found' }, { status: 404 });
		}

		// Get all books in this series
		const seriesBooks = await db.select({
			bookId: bookSeries.bookId,
			bookNum: bookSeries.bookNum,
			bookNumEnd: bookSeries.bookNumEnd
		})
			.from(bookSeries)
			.where(eq(bookSeries.seriesId, seriesId))
			.orderBy(asc(bookSeries.bookNum));

		// Get book details
		const bookDetails = await Promise.all(seriesBooks.map(async (sb) => {
			const [book] = await db.select().from(books).where(eq(books.id, sb.bookId)).limit(1);
			if (!book) return null;

			const [bookAuthorsData, statusData] = await Promise.all([
				db.select({
					id: authors.id,
					name: authors.name
				}).from(bookAuthors)
					.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
					.where(eq(bookAuthors.bookId, book.id)),
				book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				coverUrl: book.coverImageUrl,
				rating: book.rating,
				releaseDate: book.releaseDate,
				completedDate: book.completedDate,
				bookNum: sb.bookNum,
				bookNumEnd: sb.bookNumEnd,
				authors: bookAuthorsData,
				status: statusData[0] ? {
					id: statusData[0].id,
					name: statusData[0].name,
					color: statusData[0].color
				} : null
			};
		}));

		return json({
			series: {
				id: seriesData.id,
				title: seriesData.title,
				description: seriesData.description,
				numBooks: seriesData.numBooks,
				comments: seriesData.comments,
				createdAt: seriesData.createdAt,
				updatedAt: seriesData.updatedAt
			},
			books: bookDetails.filter(Boolean)
		});
	} catch (err) {
		console.error('API v1 series error:', err);
		return json({ error: 'Failed to fetch series' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/series/[id] - Update a series
 */
export const PUT: RequestHandler = async ({ params, url, request }) => {
	const token = url.searchParams.get('token');
	const seriesId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(seriesId)) {
		return json({ error: 'Invalid series ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		// Check series exists
		const [existingSeries] = await db.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).limit(1);
		if (!existingSeries) {
			return json({ error: 'Series not found' }, { status: 404 });
		}

		const updateData: Record<string, unknown> = {};
		if (body.title !== undefined) updateData.title = body.title;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.numBooks !== undefined) updateData.numBooks = body.numBooks;
		if (body.comments !== undefined) updateData.comments = body.comments;

		const updatedSeries = await updateSeries(seriesId, updateData);

		if (!updatedSeries) {
			return json({ error: 'Failed to update series' }, { status: 500 });
		}

		return json({
			series: { id: updatedSeries.id, title: updatedSeries.title },
			message: 'Series updated successfully'
		});
	} catch (err) {
		console.error('API v1 update series error:', err);
		return json({ error: 'Failed to update series' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/series/[id] - Delete a series
 */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const seriesId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(seriesId)) {
		return json({ error: 'Invalid series ID' }, { status: 400 });
	}

	try {
		// Check series exists
		const [existingSeries] = await db.select({ id: series.id, title: series.title }).from(series).where(eq(series.id, seriesId)).limit(1);
		if (!existingSeries) {
			return json({ error: 'Series not found' }, { status: 404 });
		}

		const deleted = await deleteSeries(seriesId);

		if (!deleted) {
			return json({ error: 'Failed to delete series' }, { status: 500 });
		}

		return json({
			message: `Series "${existingSeries.title}" deleted successfully`
		});
	} catch (err) {
		console.error('API v1 delete series error:', err);
		return json({ error: 'Failed to delete series' }, { status: 500 });
	}
};
