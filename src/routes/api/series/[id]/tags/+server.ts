import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, seriesTags, tags } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

// GET /api/series/[id]/tags - Get all tags for a series
export const GET: RequestHandler = async ({ params }) => {
	const seriesId = parseInt(params.id);
	if (isNaN(seriesId)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const result = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon
		})
		.from(seriesTags)
		.innerJoin(tags, eq(seriesTags.tagId, tags.id))
		.where(eq(seriesTags.seriesId, seriesId));

	return json(result);
};

// POST /api/series/[id]/tags - Add a tag to a series
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const seriesId = parseInt(params.id);
	if (isNaN(seriesId)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const { tagId } = await request.json();
	if (!tagId) {
		throw error(400, { message: 'Tag ID is required' });
	}

	const now = new Date().toISOString();

	// Check if tag already exists on series
	const existing = await db
		.select()
		.from(seriesTags)
		.where(and(eq(seriesTags.seriesId, seriesId), eq(seriesTags.tagId, tagId)))
		.limit(1);

	if (existing.length > 0) {
		return json({ message: 'Tag already on series' });
	}

	await db.insert(seriesTags).values({
		seriesId,
		tagId,
		createdAt: now,
		updatedAt: now
	});

	return json({ success: true });
};

// DELETE /api/series/[id]/tags - Remove a tag from a series
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const seriesId = parseInt(params.id);
	if (isNaN(seriesId)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const { tagId } = await request.json();
	if (!tagId) {
		throw error(400, { message: 'Tag ID is required' });
	}

	await db
		.delete(seriesTags)
		.where(and(eq(seriesTags.seriesId, seriesId), eq(seriesTags.tagId, tagId)));

	return json({ success: true });
};
