import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeNarrators } from '$lib/server/services/narratorService';

/**
 * POST /api/narrators/merge
 * Merge a duplicate narrator into the keeper
 * Body: { targetId: number, sourceId: number }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can access cleanup tools
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const data = await request.json();
	const { targetId, sourceId } = data;

	if (!Number.isInteger(targetId) || targetId <= 0 || !Number.isInteger(sourceId) || sourceId <= 0) {
		throw error(400, { message: 'targetId and sourceId are required' });
	}

	let result: Awaited<ReturnType<typeof mergeNarrators>>;
	try {
		result = await mergeNarrators(targetId, sourceId);
	} catch (err) {
		console.error('Error merging narrators:', err);
		return json(
			{ success: false, error: 'Error merging narrators' },
			{ status: 500 }
		);
	}

	if (!result.success) {
		throw error(400, { message: result.error || 'Failed to merge narrators' });
	}

	return json({
		success: true,
		message: `Merged ${result.merged} book(s) and deleted duplicate narrator`,
		merged: result.merged
	});
};
