/**
 * GET /api/v1/admin/abs/unlinked - Audio-format books without an Audiobookshelf link (admin only)
 *
 * Returns { linkedCount, unlinkedCount, unlinked: [{ id, title, author }] } (list capped at 500).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsLinkStats } from '$lib/server/services/absService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	return json(await getAbsLinkStats());
};
