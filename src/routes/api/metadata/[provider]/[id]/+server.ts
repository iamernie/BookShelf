/**
 * Metadata Details API
 *
 * GET /api/metadata/:provider/:id - Fetch full details from a specific provider
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { metadataProviders, type MetadataProvider } from '$lib/server/services/metadataProviders';

const VALID_PROVIDERS: MetadataProvider[] = ['googlebooks', 'openlibrary', 'goodreads', 'hardcover'];

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { provider, id } = params;

	if (!VALID_PROVIDERS.includes(provider as MetadataProvider)) {
		throw error(400, `Invalid provider: ${provider}`);
	}

	if (!id) {
		throw error(400, 'Provider ID is required');
	}

	try {
		const result = await metadataProviders.fetchDetails(provider as MetadataProvider, id);

		if (!result) {
			throw error(404, 'Book not found');
		}

		return json({
			success: true,
			result
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Metadata fetch error:', err);
		throw error(500, 'Failed to fetch metadata');
	}
};
