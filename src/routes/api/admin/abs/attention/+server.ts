/**
 * GET /api/admin/abs/attention?status=open|ignored|resolved - Audiobookshelf sync attention queue (admin only)
 *
 * Returns { items } (newest first, at most 500); works while sync is off.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAttention, type AttentionStatus } from '$lib/server/services/absAttentionService';

const STATUSES: AttentionStatus[] = ['open', 'ignored', 'resolved'];

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const status = (url.searchParams.get('status') ?? 'open') as AttentionStatus;
	if (!STATUSES.includes(status)) return json({ message: 'status must be open, ignored or resolved' }, { status: 400 });
	return json({ items: await listAttention(status) });
};
