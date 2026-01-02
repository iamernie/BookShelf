import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testProviderConnection } from '$lib/server/services/oidcService';

// POST /api/admin/oidc/test - Test OIDC provider connection
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const data = await request.json();

	if (!data.issuerUrl || !data.clientId || !data.clientSecret) {
		throw error(400, 'Missing required fields: issuerUrl, clientId, clientSecret');
	}

	const result = await testProviderConnection(data.issuerUrl, data.clientId, data.clientSecret);

	return json(result);
};
