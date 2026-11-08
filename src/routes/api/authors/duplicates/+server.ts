import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findDuplicateAuthors } from '$lib/server/services/authorService';

/**
 * GET /api/authors/duplicates
 * Find potential duplicate authors
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can access cleanup tools (the list carries every author with global counts)
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const duplicates = await findDuplicateAuthors();
		return json({ success: true, duplicates });
	} catch (error) {
		console.error('Error finding duplicates:', error);
		return json(
			{ success: false, error: 'Error finding duplicate authors' },
			{ status: 500 }
		);
	}
};
