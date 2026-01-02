import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findDuplicateBooks } from '$lib/server/services/bookService';

/**
 * GET /api/books/duplicates-all
 * Find all potential duplicate books in the library
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
		const duplicates = await findDuplicateBooks();
		return json({ success: true, duplicates });
	} catch (err) {
		console.error('Error finding duplicate books:', err);
		return json(
			{ success: false, error: 'Error finding duplicate books' },
			{ status: 500 }
		);
	}
};
