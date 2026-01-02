import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProviderById,
	updateProvider,
	deleteProvider,
	testProviderConnection,
	generateSlug,
	isSlugUnique
} from '$lib/server/services/oidcService';

// GET /api/admin/oidc/providers/[id] - Get single provider
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid provider ID');
	}

	const provider = await getProviderById(id);
	if (!provider) {
		throw error(404, 'Provider not found');
	}

	return json({
		...provider,
		clientSecret: '••••••••'
	});
};

// PATCH /api/admin/oidc/providers/[id] - Update provider
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid provider ID');
	}

	const provider = await getProviderById(id);
	if (!provider) {
		throw error(404, 'Provider not found');
	}

	const data = await request.json();

	// Handle slug update
	if (data.slug && data.slug !== provider.slug) {
		const slug = generateSlug(data.slug);
		if (!(await isSlugUnique(slug, id))) {
			throw error(400, 'Slug already in use');
		}
		data.slug = slug;
	}

	// If credentials changed, test connection
	const credentialsChanged =
		data.issuerUrl ||
		data.clientId ||
		(data.clientSecret && data.clientSecret !== '••••••••');

	if (credentialsChanged) {
		const issuerUrl = data.issuerUrl || provider.issuerUrl;
		const clientId = data.clientId || provider.clientId;
		const clientSecret =
			data.clientSecret && data.clientSecret !== '••••••••'
				? data.clientSecret
				: provider.clientSecret;

		const testResult = await testProviderConnection(issuerUrl, clientId, clientSecret);
		if (!testResult.success) {
			return json(
				{
					success: false,
					error: testResult.error,
					validationFailed: true
				},
				{ status: 400 }
			);
		}
	}

	// Don't update secret if it's the masked value
	if (data.clientSecret === '••••••••') {
		delete data.clientSecret;
	}

	try {
		const updated = await updateProvider(id, data);

		return json({
			success: true,
			provider: updated
				? {
						...updated,
						clientSecret: '••••••••'
					}
				: null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to update provider';
		throw error(500, message);
	}
};

// DELETE /api/admin/oidc/providers/[id] - Delete provider
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid provider ID');
	}

	const provider = await getProviderById(id);
	if (!provider) {
		throw error(404, 'Provider not found');
	}

	const success = await deleteProvider(id);

	return json({ success });
};
