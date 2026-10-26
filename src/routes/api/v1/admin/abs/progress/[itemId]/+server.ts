/**
 * GET /api/v1/admin/abs/progress/{itemId} - Listening progress for one Audiobookshelf item (admin only)
 *
 * Proxies ABS GET /api/me/progress/{itemId} (the stored API key's user).
 * Returns { ok: true, progress }, { ok: false, hasProgress: false } with 404 when
 * the item was never listened to, or { ok: false, error } with 502 when ABS fails.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsProgress } from '$lib/server/services/absService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	try {
		const progress = await getAbsProgress(params.itemId);
		if (!progress) return json({ ok: false, hasProgress: false }, { status: 404 });
		return json({ ok: true, progress });
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : 'Audiobookshelf request failed' }, { status: 502 });
	}
};
