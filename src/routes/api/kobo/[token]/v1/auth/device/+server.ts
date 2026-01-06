/**
 * Kobo Device Authentication API
 *
 * POST /api/kobo/[token]/v1/auth/device
 *
 * Authenticates a Kobo device and returns access tokens.
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
	const deviceModel = body.Model || body.model;

	if (!deviceId) {
		throw error(400, 'Device ID is required');
	}

	// Register the device and get tokens
	const { accessToken, refreshToken } = await registerDevice(user.userId, deviceId, deviceModel);

	return json({
		AccessToken: accessToken,
		RefreshToken: refreshToken,
		TokenType: 'Bearer',
		TrackingId: deviceId,
		UserKey: `bookshelf-${user.userId}`
	});
};
