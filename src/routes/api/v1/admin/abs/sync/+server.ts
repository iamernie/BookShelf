/**
 * POST /api/v1/admin/abs/sync - Run one Audiobookshelf sync now (admin only)
 *
 * Returns { ok, linked, created, errors, durationMs, lastSync, error? }.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runAbsSync } from '$lib/server/services/absService';
import { getSetting } from '$lib/server/services/settingsService';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const result = await runAbsSync();
	const lastSync = (await getSetting('integration.abs_last_sync')) || null;

	return json({ ...result, lastSync });
};
