/**
 * GET /api/v1/admin/abs/progress/{itemId} - Listening progress for one Audiobookshelf item (admin only)
 *
 * The VIEWING admin's own progress, through their own Audiobookshelf connection (2.36.0: never the
 * site key's user). Returns { ok: true, progress }, { ok: false, hasProgress: false } with 404 when
 * the item was never listened to or the admin has no connection (connected: false), or
 * { ok: false, error } with 502 when ABS fails.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsProgressForUser } from '$lib/server/services/absConnectionService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	try {
		const { connected, progress } = await getAbsProgressForUser(locals.user.id, params.itemId);
		if (!progress) return json({ ok: false, hasProgress: false, connected }, { status: 404 });
		return json({ ok: true, progress });
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : 'Audiobookshelf request failed' }, { status: 502 });
	}
};
