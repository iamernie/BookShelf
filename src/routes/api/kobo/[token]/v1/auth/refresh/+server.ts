/**
 * Kobo Token Refresh API
 *
 * POST /api/kobo/[token]/v1/auth/refresh
 *
 * Refreshes access tokens for a Kobo device.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken, registerDevice } from '$lib/server/services/koboService';

export const POST: RequestHandler = async ({ params, request }) => {
	const { token } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Parse request body
	const body = await request.json();
	const deviceId = body.DeviceId || body.deviceId || request.headers.get('x-kobo-deviceid');

	if (!deviceId) {
		throw error(400, 'Device ID is required');
	}

	// Generate new tokens
	const { accessToken, refreshToken } = await registerDevice(user.userId, deviceId);

	return json({
		AccessToken: accessToken,
		RefreshToken: refreshToken,
		TokenType: 'Bearer'
	});
};
