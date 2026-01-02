import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeBooks } from '$lib/server/services/bookService';

/**
 * POST /api/books/merge
 * Merge one book into another
 * Body: { targetId: number, sourceId: number }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can merge books
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { targetId, sourceId } = body;

	if (!targetId || !sourceId) {
		throw error(400, 'targetId and sourceId are required');
	}

	if (typeof targetId !== 'number' || typeof sourceId !== 'number') {
		throw error(400, 'targetId and sourceId must be numbers');
	}

	try {
		await mergeBooks(targetId, sourceId);
		return json({
			success: true,
			message: `Book ${sourceId} merged into book ${targetId}`
		});
	} catch (err) {
		console.error('Error merging books:', err);
		const message = err instanceof Error ? err.message : 'Error merging books';
		return json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
};
