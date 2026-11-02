import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findDuplicateNarrators } from '$lib/server/services/narratorService';

/**
 * GET /api/narrators/duplicates
 * Find potential duplicate narrators
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can access cleanup tools
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const duplicates = await findDuplicateNarrators();
		return json({ success: true, duplicates });
	} catch (err) {
		console.error('Error finding duplicate narrators:', err);
		return json(
			{ success: false, error: 'Error finding duplicate narrators' },
			{ status: 500 }
		);
	}
};
