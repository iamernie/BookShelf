/**
 * API v1 Formats Endpoint
 * CRUD operations for formats
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { createFormat } from '$lib/server/services/formatService';
import { db, formats, books } from '$lib/server/db';
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
			? sql`LOWER(${formats.name}) LIKE LOWER(${'%' + search + '%'})`
			: undefined;

		// Get total count
		const [countResult] = whereCondition
			? await db.select({ count: sql<number>`count(*)` }).from(formats).where(whereCondition)
			: await db.select({ count: sql<number>`count(*)` }).from(formats);

		// Get formats with book counts
		const query = db.select({
			id: formats.id,
			name: formats.name,
			icon: formats.icon,
			color: formats.color,
			createdAt: formats.createdAt,
			updatedAt: formats.updatedAt,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.formatId} = ${formats.id})`
		}).from(formats);

		const formatsList = whereCondition
			? await query.where(whereCondition).orderBy(desc(sql`bookCount`)).limit(limit).offset(offset)
			: await query.orderBy(desc(sql`bookCount`)).limit(limit).offset(offset);

		return json({
			formats: formatsList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 formats error:', err);
		return json({ error: 'Failed to fetch formats' }, { status: 500 });
	}
};

/**
 * POST /api/v1/formats - Create a new format
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

		const newFormat = await createFormat({
			name: body.name,
			icon: body.icon,
			color: body.color
		});

		return json({
			format: { id: newFormat.id, name: newFormat.name },
			message: 'Format created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create format error:', err);
		return json({ error: 'Failed to create format' }, { status: 500 });
	}
};
