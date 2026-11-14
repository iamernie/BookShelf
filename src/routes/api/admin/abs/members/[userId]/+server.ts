/**
 * Admin backup for members who won't make their own key (admin only)
 *
 * PUT    { apiKey } -> Assign key: the admin pastes a key created in Audiobookshelf for that user.
 *                      The key's ABS account must suit the TARGET user (no ABS admin/root key for a
 *                      non-admin). Never turns syncing on; over an existing row it turns it off, so
 *                      the member re-consents. Only apiKey is read.
 * DELETE            -> disconnect that user (row + watermarks; never touches anyone's library)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectAbsKey, disconnectAbs } from '$lib/server/services/absConnectionService';
import { checkAbsConnectLimit } from '$lib/server/services/absConnectLimiter';

function targetId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	const id = targetId(params.userId);
	if (id === null) return json({ message: 'Invalid user id' }, { status: 400 });

	const limit = checkAbsConnectLimit(locals.user.id);
	if (!limit.allowed) {
		return json({ message: 'Too many attempts. Try again later.', code: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 900) } });
	}

	let body: Record<string, unknown>;
	try {
		const parsed = await request.json();
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
		body = parsed as Record<string, unknown>;
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}
	// Syncing is the member's consent: an admin can never set it
	if ('syncListening' in body) {
		return json({ message: 'Only the member can turn listening sync on or off' }, { status: 400 });
	}

	const result = await connectAbsKey({ targetUserId: id, actor: { id: locals.user.id, role: locals.user.role }, apiKey: body.apiKey });
	if (!result.ok) return json({ message: result.message, code: result.code }, { status: result.status });
	return json({ connection: result.connection });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}
	const id = targetId(params.userId);
	if (id === null) return json({ message: 'Invalid user id' }, { status: 400 });

	const result = await disconnectAbs(id);
	if (!result.ok) return json({ message: result.message, code: result.code }, { status: result.status });
	return json({ removed: result.removed });
};
