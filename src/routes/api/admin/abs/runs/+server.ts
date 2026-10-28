/**
 * GET /api/admin/abs/runs?limit=20&before=<id> - Audiobookshelf sync run history, newest first (admin only)
 *
 * Returns { runs } without per-item details; GET /api/admin/abs/runs/[id] has them.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRuns } from '$lib/server/services/absSyncService';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
	const before = parseInt(url.searchParams.get('before') ?? '', 10);
	return json({ runs: await listRuns({ limit, before: Number.isInteger(before) ? before : undefined }) });
};
