/**
 * Kobo Library Sync API
 *
 * GET /api/kobo/[token]/v1/library/sync
 *
 * Returns entitlements (books) to sync to the Kobo device.
 * Uses pagination via X-Kobo-SyncToken header.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken, updateDeviceLastSync } from '$lib/server/services/koboService';
import { syncLibrary, encodeSyncToken } from '$lib/server/services/koboSyncService';

export const GET: RequestHandler = async ({ params, url, request }) => {
	const { token } = params;

	// Log Kobo requests for debugging
	console.log('[Kobo Sync]', {
		url: url.href,
		userAgent: request.headers.get('user-agent'),
		deviceId: request.headers.get('x-kobo-deviceid'),
		syncToken: request.headers.get('x-kobo-synctoken')?.substring(0, 50)
	});

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Get sync token from header
	const syncTokenHeader = request.headers.get('x-kobo-synctoken');

	// Perform sync
	const baseUrl = url.origin;
	const result = await syncLibrary(user.userId, baseUrl, token, syncTokenHeader);

	console.log('[Kobo Sync] Result:', {
		entitlementCount: result.entitlements.length,
		shouldContinue: result.shouldContinue,
		entitlementTypes: result.entitlements.map(e => Object.keys(e)[0])
	});

	// Update device last sync time
	const deviceId = request.headers.get('x-kobo-deviceid');
	if (deviceId) {
		await updateDeviceLastSync(user.userId, deviceId);
	}

	// Build response headers
	const headers: Record<string, string> = {
		'x-kobo-synctoken': encodeSyncToken(result.syncToken)
	};

	if (result.shouldContinue) {
		headers['x-kobo-sync'] = 'continue';
	}

	return json(result.entitlements, { headers });
};
