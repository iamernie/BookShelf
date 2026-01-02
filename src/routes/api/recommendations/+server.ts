import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRuleBasedRecommendations } from '$lib/server/services/recommendationService';

// GET - Get rule-based recommendations
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	try {
		const recommendations = await getRuleBasedRecommendations();
		return json({ recommendations });
	} catch (err) {
		console.error('Recommendations error:', err);
		throw error(500, 'Failed to get recommendations');
	}
};
