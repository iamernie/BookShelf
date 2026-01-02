import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShareableUsers } from '$lib/server/services/libraryShareService';

/**
 * GET /api/library/shares/users
 * Get all users that the current user can share their library with
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const users = await getShareableUsers(locals.user.id);
	return json({ users });
};
