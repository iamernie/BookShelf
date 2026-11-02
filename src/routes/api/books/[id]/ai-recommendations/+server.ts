import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAIRecommendationsForBook, addRecommendationToLibrary } from '$lib/server/services/recommendationService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';

/**
 * GET /api/books/[id]/ai-recommendations
 * Get AI-powered recommendations based on a specific book
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const result = await getAIRecommendationsForBook(bookId);

	if ('error' in result) {
		return json({ success: false, error: result.error }, { status: 400 });
	}

	return json({
		success: true,
		recommendations: result.recommendations,
		model: result.model
	});
};

/**
 * POST /api/books/[id]/ai-recommendations
 * Add a recommended book to the library as a wishlist item
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!hasPermission(locals.user, Permission.ADD_BOOKS)) {
		throw error(403, { message: 'You do not have permission to add books' });
	}

	const body = await request.json();
	const { title, author } = body;

	if (!title || !author) {
		throw error(400, 'Title and author are required');
	}

	const result = await addRecommendationToLibrary({ title, author });

	if (!result.success) {
		return json({ success: false, error: result.error, bookId: result.bookId }, { status: 400 });
	}

	return json({
		success: true,
		bookId: result.bookId,
		message: 'Book added to wishlist'
	});
};
