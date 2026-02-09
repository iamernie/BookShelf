/**
 * API v1 Genres Endpoint
 * Returns all genres
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, genres, books } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	try {
		const genreList = await db.select({
			id: genres.id,
			name: genres.name,
			color: genres.color,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.genreId} = ${genres.id})`
		})
			.from(genres)
			.orderBy(desc(sql`bookCount`));

		return json({ genres: genreList });
	} catch (err) {
		console.error('API v1 genres error:', err);
		return json({ error: 'Failed to fetch genres' }, { status: 500 });
	}
};
