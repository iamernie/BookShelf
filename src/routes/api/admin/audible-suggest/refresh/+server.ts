/**
 * Audible series refresh (admin only)
 *
 * POST /api/admin/audible-suggest/refresh  {} | { seriesId: number }
 *   202 { runId, startedAt, trigger, seriesId } - the run continues in the background
 *   409 { message, details: { runId, startedAt, trigger } } - a run is already in flight
 *   503 { message } - Audible metadata is turned off (no run row written)
 *   404 - unknown seriesId
 *   400 for any other body field (scheduled runs come only from the in-app scheduler)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startRefresh } from '$lib/server/services/audibleSuggestService';

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
	const unknown = Object.keys(body).filter((k) => k !== 'seriesId');
	if (unknown.length > 0) {
		return json({ message: `Unknown field: ${unknown.join(', ')}. Only "seriesId" is accepted.` }, { status: 400 });
	}
	const seriesId = body.seriesId ?? null;
	if (seriesId !== null && (typeof seriesId !== 'number' || !Number.isInteger(seriesId) || seriesId <= 0)) {
		return json({ message: 'seriesId must be a positive integer' }, { status: 400 });
	}

	const result = await startRefresh({ trigger: 'manual', userId: locals.user.id, seriesId });
	if (!result.ok) {
		return json(result.details ? { message: result.message, details: result.details } : { message: result.message }, { status: result.status });
	}

	return json(
		{ runId: result.run.id, startedAt: result.run.startedAt, trigger: result.run.triggerType, seriesId: result.run.scopeSeriesId },
		{ status: 202 }
	);
};
