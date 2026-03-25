/**
 * API v1 Narrators Endpoint
 * CRUD operations for narrators
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { getNarrators, createNarrator } from '$lib/server/services/narratorService';
import { db, narrators, books, audiobooks } from '$lib/server/db';
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
			? sql`LOWER(${narrators.name}) LIKE LOWER(${'%' + search + '%'})`
			: undefined;

		// Get total count
		const [countResult] = whereCondition
			? await db.select({ count: sql<number>`count(*)` }).from(narrators).where(whereCondition)
			: await db.select({ count: sql<number>`count(*)` }).from(narrators);

		// Get narrators with book/audiobook counts
		const query = db.select({
			id: narrators.id,
			name: narrators.name,
			bio: narrators.bio,
			birthDate: narrators.birthDate,
			deathDate: narrators.deathDate,
			birthPlace: narrators.birthPlace,
			photoUrl: narrators.photoUrl,
			website: narrators.website,
			wikipediaUrl: narrators.wikipediaUrl,
			comments: narrators.comments,
			createdAt: narrators.createdAt,
			updatedAt: narrators.updatedAt,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.narratorId} = ${narrators.id})`,
			audiobookCount: sql<number>`(SELECT COUNT(*) FROM ${audiobooks} WHERE ${audiobooks.narratorId} = ${narrators.id})`
		}).from(narrators);

		// Define the count expressions for reuse in orderBy
		const bookCountExpr = sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.narratorId} = ${narrators.id})`;
		const audiobookCountExpr = sql<number>`(SELECT COUNT(*) FROM ${audiobooks} WHERE ${audiobooks.narratorId} = ${narrators.id})`;
		const totalCountExpr = sql<number>`${bookCountExpr} + ${audiobookCountExpr}`;

		const narratorsList = whereCondition
			? await query.where(whereCondition).orderBy(desc(totalCountExpr)).limit(limit).offset(offset)
			: await query.orderBy(desc(totalCountExpr)).limit(limit).offset(offset);

		return json({
			narrators: narratorsList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 narrators error:', err);
		return json({ error: 'Failed to fetch narrators' }, { status: 500 });
	}
};

/**
 * POST /api/v1/narrators - Create a new narrator
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

		const newNarrator = await createNarrator({
			name: body.name,
			bio: body.bio,
			birthDate: body.birthDate,
			deathDate: body.deathDate,
			birthPlace: body.birthPlace,
			photoUrl: body.photoUrl,
			website: body.website,
			wikipediaUrl: body.wikipediaUrl,
			comments: body.comments
		});

		return json({
			narrator: { id: newNarrator.id, name: newNarrator.name },
			message: 'Narrator created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create narrator error:', err);
		return json({ error: 'Failed to create narrator' }, { status: 500 });
	}
};
