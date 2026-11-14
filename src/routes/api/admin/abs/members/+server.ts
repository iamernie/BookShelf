/**
 * GET /api/admin/abs/members - every non-guest user and their Audiobookshelf connection (admin only)
 *
 * Shows ABS username, key source (own / site), who connected it, sync on/off, last sync, last error.
 * Never a key or ciphertext.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSyncCadence, listMemberConnections } from '$lib/server/services/absConnectionService';
import { secretBoxRefusal } from '$lib/server/services/secretBox';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	const [members, cadence] = await Promise.all([listMemberConnections(), getSyncCadence()]);
	return json({ members, cadence, secretAvailable: secretBoxRefusal() === null }, { headers: { 'cache-control': 'no-store' } });
};
