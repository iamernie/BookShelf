/**
 * POST /api/admin/abs/links/[bookId]/verify - Re-check one book's Audiobookshelf link (admin only)
 *
 * One GET of the linked item: found clears the stale flag, a 404 sets it; other errors change nothing.
 * Returns { found, staleCleared, staleSet }.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyBookLink } from '$lib/server/services/absAttentionService';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const bookId = parseInt(params.bookId, 10);
	if (!Number.isInteger(bookId)) return json({ message: 'Invalid book ID' }, { status: 400 });

	const result = await verifyBookLink(bookId);
	if (!result.ok) return json({ message: result.message }, { status: result.status });
	return json({ found: result.found, staleCleared: result.staleCleared, staleSet: result.staleSet });
};
