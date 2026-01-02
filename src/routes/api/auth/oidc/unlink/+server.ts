import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlinkAccount } from '$lib/server/services/oidcService';

// POST /api/auth/oidc/unlink - Unlink OIDC account
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const data = await request.json();

	if (!data.providerId) {
		throw error(400, 'Provider ID is required');
	}

	const success = await unlinkAccount(locals.user.id, data.providerId);

	if (!success) {
		throw error(404, 'Link not found');
	}

	return json({ success: true });
};
