import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlinkAccount } from '$lib/server/services/oidcService';
import { lastLinkRefusal } from '$lib/server/services/localLoginService';

// POST /api/auth/oidc/unlink - Unlink OIDC account
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const data = await request.json();

	if (!data.providerId) {
		throw error(400, 'Provider ID is required');
	}

	// Password sign-in off: a user's only link can't be removed, or they couldn't sign in again (D9)
	const refusal = await lastLinkRefusal(locals.user.id, Number(data.providerId));
	if (refusal) throw error(409, { message: refusal, code: 'last_sso_link' });

	const success = await unlinkAccount(locals.user.id, data.providerId);

	if (!success) {
		throw error(404, 'Link not found');
	}

	return json({ success: true });
};
