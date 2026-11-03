/**
 * GET /api/series/next-up - for each series the user is reading (a Currently Reading, Next or
 * On Hold book in their library): the highest book they own and the next one on Audible.
 *   200 { items: [{ seriesId, seriesTitle, audibleSeriesTitle, ownedThrough, next, missing, gaps }], caughtUp, unchecked }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSeriesNextUp } from '$lib/server/services/audibleSuggestService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return json(await getSeriesNextUp(locals.user.id));
};
