/**
 * API v1 Tags Endpoint
 * CRUD operations for tags
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { createTag } from '$lib/server/services/tagService';
import { db, tags, bookTags } from '$lib/server/db';
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
			? sql`LOWER(${tags.name}) LIKE LOWER(${'%' + search + '%'})`
			: undefined;

		// Get total count
		const [countResult] = whereCondition
			? await db.select({ count: sql<number>`count(*)` }).from(tags).where(whereCondition)
			: await db.select({ count: sql<number>`count(*)` }).from(tags);

		// Get tags with book counts
		const query = db.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon,
			isSystem: tags.isSystem,
			createdAt: tags.createdAt,
			updatedAt: tags.updatedAt,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${bookTags} WHERE ${bookTags.tagId} = ${tags.id})`
		}).from(tags);

		const tagsList = whereCondition
			? await query.where(whereCondition).orderBy(desc(tags.isSystem), desc(sql`bookCount`)).limit(limit).offset(offset)
			: await query.orderBy(desc(tags.isSystem), desc(sql`bookCount`)).limit(limit).offset(offset);

		return json({
			tags: tagsList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 tags error:', err);
		return json({ error: 'Failed to fetch tags' }, { status: 500 });
	}
};

/**
 * POST /api/v1/tags - Create a new tag
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

		const newTag = await createTag({
			name: body.name,
			color: body.color,
			icon: body.icon
		});

		return json({
			tag: { id: newTag.id, name: newTag.name },
			message: 'Tag created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create tag error:', err);
		return json({ error: 'Failed to create tag' }, { status: 500 });
	}
};
