/**
 * API v1 Genres Endpoint
 * CRUD operations for genres
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { createGenre } from '$lib/server/services/genreService';
import { db, genres, books } from '$lib/server/db';
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
	const search = url.searchParams.get('search')?.trim();

	try {
		// Build where condition for search
		const whereCondition = search
			? sql`LOWER(${genres.name}) LIKE LOWER(${'%' + search + '%'})`
			: undefined;

		// Get total count
		const [countResult] = whereCondition
			? await db.select({ count: sql<number>`count(*)` }).from(genres).where(whereCondition)
			: await db.select({ count: sql<number>`count(*)` }).from(genres);

		// Get genres with book counts
		const bookCountExpr = sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.genreId} = ${genres.id})`;
		const query = db.select({
			id: genres.id,
			name: genres.name,
			description: genres.description,
			color: genres.color,
			icon: genres.icon,
			displayOrder: genres.displayOrder,
			createdAt: genres.createdAt,
			updatedAt: genres.updatedAt,
			bookCount: bookCountExpr
		}).from(genres);

		const genresList = whereCondition
			? await query.where(whereCondition).orderBy(desc(bookCountExpr)).limit(limit).offset(offset)
			: await query.orderBy(desc(bookCountExpr)).limit(limit).offset(offset);

		return json({
			genres: genresList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 genres error:', err);
		return json({ error: 'Failed to fetch genres' }, { status: 500 });
	}
};

/**
 * POST /api/v1/genres - Create a new genre
 */
export const POST: RequestHandler = async ({ url, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	try {
		const body = await request.json();

		if (!body.name) {
			return json({ error: 'name is required' }, { status: 400 });
		}

		const newGenre = await createGenre({
			name: body.name,
			description: body.description,
			color: body.color,
			icon: body.icon,
			displayOrder: body.displayOrder
		});

		return json({
			genre: { id: newGenre.id, name: newGenre.name },
			message: 'Genre created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create genre error:', err);
		return json({ error: 'Failed to create genre' }, { status: 500 });
	}
};
