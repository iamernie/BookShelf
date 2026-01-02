/**
 * Metadata Search API
 *
 * POST /api/metadata/search
 *
 * Search for book metadata across all enabled providers
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { metadataProviders, type MetadataProvider } from '$lib/server/services/metadataProviders';
import { getMetadataProviderSettings } from '$lib/server/services/settingsService';

// Configure providers from database settings
async function configureProviders() {
	const settings = await getMetadataProviderSettings();
	metadataProviders.configure({
		googlebooks: { enabled: settings.googlebooks.enabled, priority: 1 },
		openlibrary: { enabled: settings.openlibrary.enabled, priority: 2 },
		goodreads: { enabled: settings.goodreads.enabled, priority: 3 },
		hardcover: {
			enabled: settings.hardcover.enabled,
			priority: 4,
			apiKey: settings.hardcover.apiKey
		},
		amazon: {
			enabled: settings.amazon.enabled,
			priority: 5,
			domain: settings.amazon.domain as 'com' | 'co.uk' | 'de' | 'fr' | 'it' | 'es' | 'ca' | 'com.au' | 'co.jp' | 'in'
		},
		comicvine: {
			enabled: settings.comicvine.enabled,
			priority: 6,
			apiKey: settings.comicvine.apiKey
		}
	});
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	// Configure providers from settings before each request
	await configureProviders();

	const body = await request.json();
	const { title, author, isbn, providers, limit } = body as {
		title?: string;
		author?: string;
		isbn?: string;
		providers?: MetadataProvider[];
		limit?: number;
	};

	// Validate input
	if (!title && !author && !isbn) {
		throw error(400, 'At least one of title, author, or isbn is required');
	}

	try {
		const results = await metadataProviders.searchAll(
			{ title, author, isbn },
			{ providers, limit: limit || 10 }
		);

		// Convert Map to object for JSON serialization
		const resultsObject: Record<string, unknown[]> = {};
		for (const [provider, providerResults] of results) {
			resultsObject[provider] = providerResults;
		}

		return json({
			success: true,
			results: resultsObject
		});
	} catch (err) {
		console.error('Metadata search error:', err);
		throw error(500, 'Failed to search metadata');
	}
};

/**
 * GET /api/metadata/search?q=...&provider=...
 *
 * Simple search endpoint for quick lookups
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	// Configure providers from settings before each request
	await configureProviders();

	const query = url.searchParams.get('q');
	const provider = url.searchParams.get('provider') as MetadataProvider | null;
	const isbn = url.searchParams.get('isbn');
	const limit = parseInt(url.searchParams.get('limit') || '10');

	console.log('[metadata-search] Search params:', { query, provider, isbn, limit });

	if (!query && !isbn) {
		throw error(400, 'Query parameter q or isbn is required');
	}

	try {
		if (provider) {
			// Search specific provider
			console.log('[metadata-search] Searching single provider:', provider);
			const results = await metadataProviders.search(
				provider,
				{
					title: query || undefined,
					isbn: isbn || undefined
				},
				limit
			);
			console.log('[metadata-search] Results from', provider, ':', results.length);
			return json({ success: true, provider, results });
		} else {
			// Search all enabled providers
			console.log('[metadata-search] Searching all enabled providers');
			const results = await metadataProviders.searchAll(
				{
					title: query || undefined,
					isbn: isbn || undefined
				},
				{ limit }
			);

			const resultsObject: Record<string, unknown[]> = {};
			for (const [prov, provResults] of results) {
				resultsObject[prov] = provResults;
				console.log('[metadata-search] Results from', prov, ':', provResults.length);
			}

			console.log('[metadata-search] Total providers with results:', Object.keys(resultsObject).length);
			return json({ success: true, results: resultsObject });
		}
	} catch (err) {
		console.error('Metadata search error:', err);
		throw error(500, 'Failed to search metadata');
	}
};
