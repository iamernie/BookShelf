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
		googlebooks: {
			enabled: settings.googlebooks.enabled,
			priority: 1,
			apiKey: settings.googlebooks.apiKey
		},
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
		},
		audible: {
			enabled: settings.audible.enabled,
			priority: 7,
			domain: settings.audible.domain as 'com' | 'co.uk' | 'de' | 'fr' | 'it' | 'es' | 'ca' | 'com.au' | 'co.jp' | 'in'
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
		const results = await metadataProviders.searchAllWithStatus(
			{ title, author, isbn },
			{ providers, limit: limit || 10 }
		);

		// Convert Map to object for JSON serialization
		const resultsObject: Record<string, { results: unknown[]; error?: string; errorCode?: string }> = {};
		for (const [provider, providerResponse] of results) {
			resultsObject[provider] = {
				results: providerResponse.results,
				error: providerResponse.error,
				errorCode: providerResponse.errorCode
			};
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
			const providerInstance = metadataProviders.getProvider(provider);
			if (!providerInstance) {
				throw error(400, `Unknown provider: ${provider}`);
			}

			let response;
			if (providerInstance.searchWithStatus) {
				response = await providerInstance.searchWithStatus(
					{ title: query || undefined, isbn: isbn || undefined },
					limit
				);
			} else {
				const results = await providerInstance.search(
					{ title: query || undefined, isbn: isbn || undefined },
					limit
				);
				response = { results };
			}

			console.log('[metadata-search] Results from', provider, ':', response.results.length);
			if (response.error) {
				console.log('[metadata-search] Error from', provider, ':', response.error);
			}

			return json({
				success: true,
				provider,
				results: response.results,
				error: response.error,
				errorCode: response.errorCode
			});
		} else {
			// Search all enabled providers
			console.log('[metadata-search] Searching all enabled providers');
			const results = await metadataProviders.searchAllWithStatus(
				{
					title: query || undefined,
					isbn: isbn || undefined
				},
				{ limit }
			);

			const resultsObject: Record<string, { results: unknown[]; error?: string; errorCode?: string }> = {};
			for (const [prov, provResponse] of results) {
				resultsObject[prov] = {
					results: provResponse.results,
					error: provResponse.error,
					errorCode: provResponse.errorCode
				};
				console.log('[metadata-search] Results from', prov, ':', provResponse.results.length, provResponse.error ? `(${provResponse.error})` : '');
			}

			console.log('[metadata-search] Total providers with results:', Object.keys(resultsObject).length);
			return json({ success: true, results: resultsObject });
		}
	} catch (err) {
		console.error('Metadata search error:', err);
		throw error(500, 'Failed to search metadata');
	}
};
