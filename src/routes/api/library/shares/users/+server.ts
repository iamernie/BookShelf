import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShareableUsers } from '$lib/server/services/libraryShareService';
import { isAdmin } from '$lib/server/services/permissionService';

/**
 * GET /api/library/shares/users
 * Get all users that the current user can share their library with. Picking a user needs only
 * the id and name; email addresses go to admins alone
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const users = await getShareableUsers(locals.user.id);
	if (isAdmin(locals.user)) return json({ users });
	return json({ users: users.map(({ id, username }) => ({ id, username })) });
};
