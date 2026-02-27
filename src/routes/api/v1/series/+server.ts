/**
 * API v1 Series Endpoint
 * CRUD operations for series
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { createSeries } from '$lib/server/services/seriesService';
import { db, series, bookSeries } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

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

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);

	try {
		// Get total count
		const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(series);

		// Get series with book counts
		const seriesList = await db.select({
			id: series.id,
			title: series.title,
			description: series.description,
			numBooks: series.numBooks,
			comments: series.comments,
			createdAt: series.createdAt,
			updatedAt: series.updatedAt,
			bookCount: sql<number>`(SELECT COUNT(DISTINCT ${bookSeries.bookId}) FROM ${bookSeries} WHERE ${bookSeries.seriesId} = ${series.id})`
		})
			.from(series)
			.orderBy(desc(sql`bookCount`))
			.limit(limit)
			.offset(offset);

		return json({
			series: seriesList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 series error:', err);
		return json({ error: 'Failed to fetch series' }, { status: 500 });
	}
};

/**
 * POST /api/v1/series - Create a new series
 */
export const POST: RequestHandler = async ({ url, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	try {
		const body = await request.json();

		if (!body.title) {
			return json({ error: 'title is required' }, { status: 400 });
		}

		const newSeries = await createSeries({
			title: body.title,
			description: body.description,
			numBooks: body.numBooks,
			comments: body.comments
		});

		return json({
			series: { id: newSeries.id, title: newSeries.title },
			message: 'Series created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create series error:', err);
		return json({ error: 'Failed to create series' }, { status: 500 });
	}
};
