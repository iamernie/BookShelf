import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAvailableSources } from '$lib/server/services/wikipediaService';

/**
 * GET /api/authors/wikipedia/sources
 * Get list of available author metadata sources
 */
export const GET: RequestHandler = async () => {
	try {
		const sources = getAvailableSources();
		return json({ success: true, sources });
	} catch (error) {
		console.error('Error getting sources:', error);
		return json(
			{ success: false, error: 'Error occurred while getting sources' },
			{ status: 500 }
		);
	}
};
