/**
 * Audiobookshelf sync (admin only)
 *
 * POST /api/admin/abs/sync  { mode?: 'apply' | 'preview' }
 *   202 { runId, startedAt, mode, trigger } - the run continues in the background
 *   409 { message, details: { runId, startedAt, trigger } } - a run is already in flight
 *   503 { message } - sync off, URL/key missing, or no valid sync owner (no run row written)
 *   400 for an unknown mode or any other body field (scheduled runs come only from the in-app scheduler)
 *
 * GET /api/admin/abs/sync - overview: toggles, owner, running/last run, counts, schedule
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSyncOverview, startSync } from '$lib/server/services/absSyncService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	return json(await getSyncOverview());
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	let body: Record<string, unknown> = {};
	const text = await request.text();
	if (text.trim()) {
		try {
			const parsed = JSON.parse(text);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
			body = parsed as Record<string, unknown>;
		} catch {
			return json({ message: 'Invalid JSON body' }, { status: 400 });
		}
	}

	// Only the scheduler starts scheduled runs, so no caller can touch the failure streak
	const unknown = Object.keys(body).filter((k) => k !== 'mode');
	if (unknown.length > 0) {
		return json({ message: `Unknown field: ${unknown.join(', ')}. Only "mode" is accepted.` }, { status: 400 });
	}
	const mode = body.mode ?? 'apply';
	if (mode !== 'apply' && mode !== 'preview') {
		return json({ message: 'mode must be "apply" or "preview"' }, { status: 400 });
	}

	const result = await startSync({ mode, trigger: 'manual', userId: locals.user.id });
	if (!result.ok) {
		return json(result.details ? { message: result.message, details: result.details } : { message: result.message }, { status: result.status });
	}

	return json(
		{ runId: result.run.id, startedAt: result.run.startedAt, mode: result.run.mode, trigger: result.run.triggerType },
		{ status: 202 }
	);
};
