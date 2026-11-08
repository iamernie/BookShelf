import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAIRecommendations,
	getAISettings,
	saveAISettings,
	testAIConnection,
	addRecommendationToLibrary
} from '$lib/server/services/recommendationService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';

// GET - Get AI recommendations
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const limit = parseInt(url.searchParams.get('limit') || '10', 10);

	try {
		const result = await getAIRecommendations(locals.user.id, Math.min(limit, 20));
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

	if (!hasPermission(locals.user, Permission.ADD_BOOKS)) {
		throw error(403, { message: 'You do not have permission to add books' });
	}

	try {
		const { title, author, genre } = await request.json();

		if (!title) {
			throw error(400, 'Title is required');
		}

		const result = await addRecommendationToLibrary({ title, author, genre }, locals.user.id);
		return json(result);
	} catch (err) {
		if (err instanceof Response) throw err;
		console.error('Add recommendation error:', err);
		throw error(500, 'Failed to add recommendation');
	}
};
