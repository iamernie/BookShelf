import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeAuthors } from '$lib/server/services/authorService';

/**
 * POST /api/authors/merge
 * Merge duplicate authors
 * Body: { targetId: number, sourceId: number }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();
	const { targetId, sourceId } = data;

	if (!targetId || !sourceId) {
		throw error(400, { message: 'targetId and sourceId are required' });
	}

	const result = await mergeAuthors(targetId, sourceId);

	if (!result.success) {
		throw error(400, { message: result.error || 'Failed to merge authors' });
	}

	return json({
		success: true,
		message: `Merged ${result.merged} book(s) and deleted duplicate author`,
		merged: result.merged
	});
};
