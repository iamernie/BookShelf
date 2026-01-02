/**
 * Metadata Providers API
 *
 * GET /api/metadata/providers - List available providers with status
 * PUT /api/metadata/providers - Update provider settings (admin only)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { metadataProviders } from '$lib/server/services/metadataProviders';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const providers = metadataProviders.getProviderInfo();

	return json({
		success: true,
		providers
	});
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	// Check if user is admin
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { settings } = body;

	if (!settings) {
		throw error(400, 'Settings object is required');
	}

	try {
		metadataProviders.configure(settings);

		// TODO: Persist settings to database
		// await saveMetadataProviderSettings(settings);

		return json({
			success: true,
			message: 'Provider settings updated',
			providers: metadataProviders.getProviderInfo()
		});
	} catch (err) {
		console.error('Error updating provider settings:', err);
		throw error(500, 'Failed to update settings');
	}
};
