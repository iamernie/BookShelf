/**
 * KOReader Progress Retrieval
 *
 * GET /api/koreader/syncs/progress/[document] - Get reading progress for a document
 *
 * Headers:
 *   x-auth-user: KOReader username
 *   x-auth-key: MD5 hash of KOReader password
 *
 * Returns progress data or empty object if not found
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateKoreaderAuth, getProgress } from '$lib/server/services/koreaderService';

export const GET: RequestHandler = async ({ request, params }) => {
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

	const documentHash = params.document;

	if (!documentHash) {
		return json({ message: 'Missing document hash' }, { status: 400 });
	}

	const progress = await getProgress(auth.userId, documentHash);

	if (!progress) {
		// Return empty object if no progress found (KOReader expects this)
		return json({});
	}

	return json(progress);
};
