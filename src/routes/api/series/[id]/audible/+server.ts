/**
 * GET /api/series/[id]/audible - the series' Audible suggestions for the current user
 *   200 { state, audibleSeriesTitle, refreshedAt, lastRefreshFailed, ownedThrough, canAdd, suggestions, next, missing, gaps, seriesInfo }
 *   missing: unowned numbered books below ownedThrough other than next (gaps = missing.length);
 *   seriesInfo: { bookCount, totalRuntimeMin, firstReleaseYear } from the saved list, null without one
 *   Reads the saved list only; never calls Audible. 404 for an unknown series.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSeriesSuggestions } from '$lib/server/services/audibleSuggestService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!/^\d+$/.test(params.id)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const result = await getSeriesSuggestions(Number(params.id), locals.user.id);
	if (!result) {
		throw error(404, { message: 'Series not found' });
	}

	return json({ ...result, canAdd: hasPermission(locals.user, Permission.ADD_BOOKS) });
};
