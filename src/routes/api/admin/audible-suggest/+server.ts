/**
 * GET /api/admin/audible-suggest - Audible series refresh overview (admin only):
 * enabled, running/last run, schedule, series counts by match state
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRefreshOverview } from '$lib/server/services/audibleSuggestService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	return json(await getRefreshOverview());
};
