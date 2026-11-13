import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rotateBypassSecret, getBypassUrl } from '$lib/server/services/localLoginService';

// POST /api/admin/auth/local-login/rotate - replace the emergency sign-in secret (admin only).
// The old URL and every open emergency window stop working at once. Returns the new URL, never cached.
export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Authentication required');
	if (locals.user.role !== 'admin') throw error(403, 'Admin access required');
	rotateBypassSecret(locals.user);
	return json({ url: await getBypassUrl(url.origin) }, { headers: { 'Cache-Control': 'no-store' } });
};
