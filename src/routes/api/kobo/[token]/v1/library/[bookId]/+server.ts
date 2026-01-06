/**
 * Kobo Library Book API
 *
 * DELETE /api/kobo/[token]/v1/library/[bookId]
 *
 * Remove a book from the Kobo library (removes the kobo tag).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken, removeKoboTagFromBook } from '$lib/server/services/koboService';

export const DELETE: RequestHandler = async ({ params }) => {
	const { token, bookId } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		// Non-numeric ID - proxy to Kobo store would go here
		return json({});
	}

	// Remove the kobo tag from the book
	await removeKoboTagFromBook(user.userId, numericId);

	return json({});
};
