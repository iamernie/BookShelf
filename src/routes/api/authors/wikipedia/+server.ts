import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchWithPreview,
	searchWikipedia,
	searchFandom,
	getAvailableSources,
	type WikiSource
} from '$lib/server/services/wikipediaService';

/**
 * GET /api/authors/wikipedia
 * Search for author information from Wikipedia/Fandom
 *
 * Query params:
 *   - name: Author name to search for (required)
 *   - source: 'all' (default), 'wikipedia', or 'fandom'
 */
export const GET: RequestHandler = async ({ url }) => {
	const name = url.searchParams.get('name');
	const source = (url.searchParams.get('source') || 'all') as 'all' | WikiSource;

	if (!name || name.trim().length === 0) {
		return json({ success: false, error: 'Author name is required' }, { status: 400 });
	}

	try {
		let result;

		if (source === 'all') {
			// Search all sources with fallback and preview
			result = await searchWithPreview(name.trim());
		} else if (source === 'wikipedia') {
			result = await searchWikipedia(name.trim());
		} else if (source === 'fandom') {
			result = await searchFandom(name.trim());
		} else {
			return json({ success: false, error: 'Invalid source' }, { status: 400 });
		}

		return json(result);
	} catch (error) {
		console.error('Error searching for author:', error);
		return json(
			{ success: false, error: 'Error occurred while searching for author' },
			{ status: 500 }
		);
	}
};
