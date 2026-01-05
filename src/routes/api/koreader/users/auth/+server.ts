/**
 * KOReader User Authentication
 *
 * GET /api/koreader/users/auth - Authenticate KOReader user
 *
 * Headers:
 *   x-auth-user: KOReader username
 *   x-auth-key: MD5 hash of KOReader password
 *
 * Returns:
 *   200 OK with username if authenticated
 *   401 Unauthorized if authentication fails
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateKoreaderAuth } from '$lib/server/services/koreaderService';

export const GET: RequestHandler = async ({ request }) => {
	const username = request.headers.get('x-auth-user');
	const authKey = request.headers.get('x-auth-key');

	if (!username || !authKey) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const auth = await validateKoreaderAuth(username, authKey);

	if (!auth) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	if (!auth.syncEnabled) {
		return json({ message: 'Sync disabled' }, { status: 403 });
	}

	return json({ username });
};
