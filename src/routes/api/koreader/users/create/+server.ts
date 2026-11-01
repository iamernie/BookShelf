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
	// 402 is the code KOReader treats as a failed registration and shows the message for
	return json(
		{ message: 'User registration is disabled. Create credentials in BookShelf settings, then use Login.' },
		{ status: 402 }
	);
};
