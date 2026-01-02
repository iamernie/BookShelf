import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findDuplicateAuthors } from '$lib/server/services/authorService';

/**
 * GET /api/authors/duplicates
 * Find potential duplicate authors
 */
export const GET: RequestHandler = async () => {
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
