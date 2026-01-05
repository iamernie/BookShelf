/**
 * KOReader User Registration (Disabled)
 *
 * POST /api/koreader/users/create - Register new KOReader user
 *
 * This endpoint is disabled - users must create KOReader credentials
 * through the BookShelf web UI after logging in.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	// User registration is disabled - must use BookShelf UI
	return json(
		{ message: 'Registration disabled. Create KOReader credentials in BookShelf settings.' },
		{ status: 403 }
	);
};
