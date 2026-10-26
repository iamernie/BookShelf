/**
 * POST /api/v1/admin/abs/sync - Run one Audiobookshelf sync now (admin only)
 *
 * Returns { ok, linked, created, errors, durationMs, lastSync, status, error? }.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsSyncStatus, runAbsSync } from '$lib/server/services/absService';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const result = await runAbsSync();
	const status = await getAbsSyncStatus();

	return json({ ...result, lastSync: status.lastSync, status });
};
