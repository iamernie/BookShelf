import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAIRecommendations,
	getAISettings,
	saveAISettings,
	testAIConnection,
	addRecommendationToLibrary
} from '$lib/server/services/recommendationService';

// GET - Get AI recommendations
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const limit = parseInt(url.searchParams.get('limit') || '10', 10);

	try {
		const result = await getAIRecommendations(Math.min(limit, 20));
		return json(result);
	} catch (err) {
		console.error('AI recommendations error:', err);
		throw error(500, 'Failed to get AI recommendations');
	}
};

// POST - Add AI recommendation to library
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	try {
		const { title, author, genre } = await request.json();

		if (!title) {
			throw error(400, 'Title is required');
		}

		const result = await addRecommendationToLibrary({ title, author, genre });
		return json(result);
	} catch (err) {
		if (err instanceof Response) throw err;
		console.error('Add recommendation error:', err);
		throw error(500, 'Failed to add recommendation');
	}
};
