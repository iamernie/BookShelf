/**
 * KOReader Progress Sync
 *
 * PUT /api/koreader/syncs/progress - Update reading progress
 *
 * Headers:
 *   x-auth-user: KOReader username
 *   x-auth-key: MD5 hash of KOReader password
 *
 * Body:
 *   {
 *     "document": "md5-hash-of-document",
 *     "progress": "location-string",
 *     "percentage": 0.45,
 *     "device": "device-name",
 *     "device_id": "device-id"
 *   }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	validateKoreaderAuth,
	saveProgress,
	type KoreaderProgressData
} from '$lib/server/services/koreaderService';

export const PUT: RequestHandler = async ({ request }) => {
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

	let data: KoreaderProgressData;
	try {
		data = await request.json();
	} catch {
		return json({ message: 'Invalid JSON' }, { status: 400 });
	}

	if (!data.document) {
		return json({ message: 'Missing document hash' }, { status: 400 });
	}

	const result = await saveProgress(auth.userId, {
		document: data.document,
		progress: data.progress || '',
		percentage: data.percentage || 0,
		device: data.device || 'unknown',
		device_id: data.device_id || 'unknown',
		timestamp: data.timestamp
	});

	return json(result);
};
