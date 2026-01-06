/**
 * Kobo Settings API
 *
 * GET - Get Kobo settings for current user
 * PUT - Create/enable Kobo sync for current user
 * PATCH - Toggle sync enabled/disabled or regenerate token
 * DELETE - Delete Kobo settings
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getKoboSettings,
	upsertKoboSettings,
	toggleSync,
	regenerateToken,
	deleteKoboSettings,
	getDevices
} from '$lib/server/services/koboService';
import { getSyncStats } from '$lib/server/services/koboSyncService';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settings = await getKoboSettings(locals.user.id);

	if (!settings) {
		return json({
			configured: false
		});
	}

	// Get additional info
	const devices = await getDevices(locals.user.id);
	const stats = await getSyncStats(locals.user.id);

	// Build sync URL
	const origin = url.origin;
	const syncUrl = `${origin}/api/kobo/${settings.token}`;

	return json({
		configured: true,
		token: settings.token,
		syncEnabled: settings.syncEnabled,
		syncUrl,
		devices,
		stats
	});
};

export const PUT: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settings = await upsertKoboSettings(locals.user.id);

	return json({
		configured: true,
		token: settings.token,
		syncEnabled: settings.syncEnabled,
		message: 'Kobo sync enabled'
	});
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	// Handle regenerate token request
	if (body.regenerateToken) {
		const newToken = await regenerateToken(locals.user.id);
		return json({
			token: newToken,
			message: 'Token regenerated. You will need to reconfigure your Kobo device.'
		});
	}

	// Handle sync enabled toggle
	if (typeof body.syncEnabled === 'boolean') {
		const settings = await getKoboSettings(locals.user.id);
		if (settings && settings.syncEnabled !== body.syncEnabled) {
			await toggleSync(locals.user.id);
		}
		return json({
			syncEnabled: body.syncEnabled,
			message: body.syncEnabled ? 'Sync enabled' : 'Sync disabled'
		});
	}

	// Legacy action-based API
	const { action } = body;

	if (action === 'toggle') {
		const newState = await toggleSync(locals.user.id);
		return json({
			syncEnabled: newState,
			message: newState ? 'Sync enabled' : 'Sync disabled'
		});
	}

	if (action === 'regenerate') {
		const newToken = await regenerateToken(locals.user.id);
		return json({
			token: newToken,
			message: 'Token regenerated. You will need to reconfigure your Kobo device.'
		});
	}

	throw error(400, 'Invalid request');
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	await deleteKoboSettings(locals.user.id);

	return json({
		message: 'Kobo sync settings deleted'
	});
};
