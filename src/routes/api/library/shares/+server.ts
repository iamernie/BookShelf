import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	shareLibrary,
	removeShare,
	getLibraryShares,
	getSharedLibraries,
	updateSharePermission,
	getShareableUsers
} from '$lib/server/services/libraryShareService';
import type { LibrarySharePermission } from '$lib/server/db/schema';

/**
 * GET /api/library/shares
 * Get library shares for the current user
 * Query params:
 *   - type: 'shared_with_me' | 'my_shares' (default: 'my_shares')
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const type = url.searchParams.get('type') || 'my_shares';

	if (type === 'shared_with_me') {
		// Libraries that others have shared with me
		const shares = await getSharedLibraries(locals.user.id);
		return json({ shares });
	} else {
		// My library shares (who I've shared with)
		const shares = await getLibraryShares(locals.user.id);
		return json({ shares });
	}
};

/**
 * POST /api/library/shares
 * Share your library with another user
 * Body: { userId: number, permission: 'read' | 'read_write' | 'full' }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.userId) {
		throw error(400, { message: 'userId is required' });
	}

	const permission = (data.permission || 'read') as LibrarySharePermission;
	if (!['read', 'read_write', 'full'].includes(permission)) {
		throw error(400, { message: 'Invalid permission level' });
	}

	try {
		const share = await shareLibrary(locals.user.id, data.userId, permission);
		return json(share, { status: 201 });
	} catch (e) {
		if (e instanceof Error && e.message === 'Cannot share library with yourself') {
			throw error(400, { message: e.message });
		}
		throw e;
	}
};

/**
 * PUT /api/library/shares
 * Update permission for an existing share
 * Body: { userId: number, permission: 'read' | 'read_write' | 'full' }
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.userId) {
		throw error(400, { message: 'userId is required' });
	}

	const permission = data.permission as LibrarySharePermission;
	if (!['read', 'read_write', 'full'].includes(permission)) {
		throw error(400, { message: 'Invalid permission level' });
	}

	const updated = await updateSharePermission(locals.user.id, data.userId, permission);
	if (!updated) {
		throw error(404, { message: 'Share not found' });
	}

	return json({ success: true });
};

/**
 * DELETE /api/library/shares
 * Remove a library share
 * Query params: userId
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const userId = url.searchParams.get('userId');
	if (!userId) {
		throw error(400, { message: 'userId is required' });
	}

	const removed = await removeShare(locals.user.id, parseInt(userId));
	if (!removed) {
		throw error(404, { message: 'Share not found' });
	}

	return json({ success: true });
};
