/**
 * API v1 Series Endpoint
 * Returns all series with book counts
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, series, bookSeries } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

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
