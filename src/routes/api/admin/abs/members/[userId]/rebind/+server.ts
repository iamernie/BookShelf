/**
 * POST /api/admin/abs/members/{userId}/rebind - Re-bind a 'site' connection (admin only)
 *
 * For the sync owner's connection that reuses the site API key, after that key was changed to
 * another Audiobookshelf user (the row stops at identity_changed and syncs nothing). Binds the row
 * to whoever the site key belongs to now and resets its history baseline and watermarks in one
 * transaction, so the new account's past listening never counts as new. Listening sync is turned
 * off unless the owner does this for themselves.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rebindSiteConnection } from '$lib/server/services/absConnectionService';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	const id = Number(params.userId);
	if (!Number.isInteger(id) || id <= 0) return json({ message: 'Invalid user id' }, { status: 400 });

	const result = await rebindSiteConnection(id, { id: locals.user.id });
	if (!result.ok) return json({ message: result.message, code: result.code }, { status: result.status });
	return json({ connection: result.connection });
};
