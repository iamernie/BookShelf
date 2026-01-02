import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findDuplicateSeries } from '$lib/server/services/seriesService';

/**
 * GET /api/series/duplicates
 * Find potential duplicate series
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
		const duplicates = await findDuplicateSeries();
		return json({ success: true, duplicates });
	} catch (err) {
		console.error('Error finding duplicate series:', err);
		return json(
			{ success: false, error: 'Error finding duplicate series' },
			{ status: 500 }
		);
	}
};
