/**
 * GET /api/v1/admin/abs/item/{itemId} - Fetch one Audiobookshelf item's details (admin only)
 *
 * Proxies ABS GET /api/items/{itemId} for the book Media panel.
 * Returns { ok: true, item } or { ok: false, error } (502 when ABS fails).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsItem } from '$lib/server/services/absService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	try {
		return json({ ok: true, item: await getAbsItem(params.itemId) });
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : 'Audiobookshelf request failed' }, { status: 502 });
	}
};
