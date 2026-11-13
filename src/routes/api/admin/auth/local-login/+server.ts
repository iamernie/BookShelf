import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getLocalLoginAdminState,
	getBypassUrl,
	setLocalLoginDisabled
} from '$lib/server/services/localLoginService';

const NO_STORE = { 'Cache-Control': 'no-store' };

function requireAdmin(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Authentication required');
	if (locals.user.role !== 'admin') throw error(403, 'Admin access required');
	return locals.user;
}

// GET /api/admin/auth/local-login - state plus the emergency sign-in URL (admin only, never cached)
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAdmin(locals);
	const state = await getLocalLoginAdminState(user.id);
	return json({ ...state, url: await getBypassUrl(url.origin) }, { headers: NO_STORE });
};

// PUT /api/admin/auth/local-login { disabled: boolean } - turn password sign-in off or back on
export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = requireAdmin(locals);
	const body = await request.json().catch(() => null);
	if (!body || typeof body.disabled !== 'boolean') {
		throw error(400, { message: 'disabled must be true or false' });
	}
	const result = await setLocalLoginDisabled(body.disabled, user);
	if (!result.ok) {
		throw error(409, { message: result.message, code: result.code });
	}
	return json(result, { headers: NO_STORE });
};
