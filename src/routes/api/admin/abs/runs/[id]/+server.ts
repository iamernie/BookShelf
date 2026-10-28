/**
 * GET /api/admin/abs/runs/[id] - One Audiobookshelf sync run with its per-item details (admin only)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRun } from '$lib/server/services/absSyncService';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const id = parseInt(params.id, 10);
	if (!Number.isInteger(id)) return json({ message: 'Invalid run ID' }, { status: 400 });

	const run = await getRun(id);
	if (!run) return json({ message: 'Run not found' }, { status: 404 });
	return json(run);
};
