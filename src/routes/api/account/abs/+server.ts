/**
 * The signed-in user's own Audiobookshelf connection (2.36.0)
 *
 * GET    -> { available, baseUrl, secretAvailable, connection, cadence, unplaced }
 * PUT    { apiKey }          -> connect or replace the key (checked against the admin-configured
 *                               server only; any other field, a URL included, is ignored)
 * PATCH  { syncListening }   -> the member's own consent (default off)
 * DELETE                     -> disconnect (row + watermarks; never touches the library)
 *
 * Every role but guest. 503 when Audiobookshelf is not set up (PUT) or keys can't be stored.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';
import {
	connectAbsKey,
	disconnectAbs,
	getConnection,
	getSyncCadence,
	getUnplacedCount,
	setSyncListening,
	toConnectionView
} from '$lib/server/services/absConnectionService';
import { checkAbsConnectLimit } from '$lib/server/services/absConnectLimiter';
import { secretBoxRefusal } from '$lib/server/services/secretBox';

type User = NonNullable<App.Locals['user']>;

function gate(user: App.Locals['user']): Response | User {
	if (!user) return json({ message: 'Unauthorized' }, { status: 401 });
	if (user.role === 'guest') return json({ message: 'Guests cannot connect Audiobookshelf' }, { status: 403 });
	return user;
}

async function readObject(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ locals }) => {
	const user = gate(locals.user);
	if (user instanceof Response) return user;

	const [baseUrl, conn, cadence, unplaced] = await Promise.all([
		getAbsLinkBaseUrl(),
		getConnection(user.id),
		getSyncCadence(),
		getUnplacedCount(user.id)
	]);
	return json({
		available: !!baseUrl,
		baseUrl,
		secretAvailable: secretBoxRefusal() === null,
		connection: toConnectionView(conn),
		cadence,
		unplaced
	}, { headers: { 'cache-control': 'no-store' } });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = gate(locals.user);
	if (user instanceof Response) return user;

	const limit = checkAbsConnectLimit(user.id);
	if (!limit.allowed) {
		return json({ message: 'Too many attempts. Try again later.', code: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 900) } });
	}
	const body = await readObject(request);
	if (!body) return json({ message: 'Invalid JSON body' }, { status: 400 });

	// Only apiKey is read: the server URL always comes from the admin's settings
	const result = await connectAbsKey({ targetUserId: user.id, actor: { id: user.id, role: user.role }, apiKey: body.apiKey });
	if (!result.ok) return json({ message: result.message, code: result.code }, { status: result.status });
	return json({ connection: result.connection });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const user = gate(locals.user);
	if (user instanceof Response) return user;

	const body = await readObject(request);
	if (!body) return json({ message: 'Invalid JSON body' }, { status: 400 });
	const unknown = Object.keys(body).filter((k) => k !== 'syncListening');
	if (unknown.length > 0 || typeof body.syncListening !== 'boolean') {
		return json({ message: 'Only "syncListening" (true or false) can be changed' }, { status: 400 });
	}
	const view = await setSyncListening(user.id, body.syncListening);
	if (!view) return json({ message: 'Not connected to Audiobookshelf' }, { status: 404 });
	return json({ connection: view });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const user = gate(locals.user);
	if (user instanceof Response) return user;

	const result = await disconnectAbs(user.id);
	if (!result.ok) return json({ message: result.message, code: result.code }, { status: result.status });
	return json({ removed: result.removed });
};
