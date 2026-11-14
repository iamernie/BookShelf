/**
 * "Add what I've already listened to" (2.36.0): the member's explicit import of listening from
 * before they connected, by the same rules as the sync (5 minutes or finished; public-library books
 * are added, books only in someone else's personal library are left alone; Done never moves back).
 *
 * GET  -> { added, changed, unplaced } counts only, nothing written
 * POST -> the import; 409 while an Audiobookshelf sync is running (and the sync waits for it)
 *
 * Every role but guest. Writes no sync-run row, so the sync schedule is untouched.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importListeningHistory } from '$lib/server/services/absMemberSyncService';

function gate(user: App.Locals['user']): Response | null {
	if (!user) return json({ message: 'Unauthorized' }, { status: 401 });
	if (user.role === 'guest') return json({ message: 'Guests cannot connect Audiobookshelf' }, { status: 403 });
	return null;
}

const respond = (r: Awaited<ReturnType<typeof importListeningHistory>>) =>
	r.ok ? json({ added: r.added, changed: r.changed, unplaced: r.unplaced }) : json({ message: r.message, code: r.code }, { status: r.status });

export const GET: RequestHandler = async ({ locals }) => {
	const denied = gate(locals.user);
	if (denied) return denied;
	return respond(await importListeningHistory(locals.user!.id, { preview: true }));
};

export const POST: RequestHandler = async ({ locals }) => {
	const denied = gate(locals.user);
	if (denied) return denied;
	return respond(await importListeningHistory(locals.user!.id, { preview: false }));
};
