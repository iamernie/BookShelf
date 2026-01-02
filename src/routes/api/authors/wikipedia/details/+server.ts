import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAuthorDataBySource,
	type WikiSource
} from '$lib/server/services/wikipediaService';

/**
 * GET /api/authors/wikipedia/details
 * Get detailed author data from a specific Wikipedia or Fandom page
 *
 * Query params:
 *   - pageTitle: The Wikipedia/Fandom page title (required)
 *   - source: 'wikipedia' (default) or 'fandom'
 */
export const GET: RequestHandler = async ({ url }) => {
	const pageTitle = url.searchParams.get('pageTitle');
	const source = (url.searchParams.get('source') || 'wikipedia') as WikiSource;

	if (!pageTitle || pageTitle.trim().length === 0) {
		return json({ success: false, error: 'Page title is required' }, { status: 400 });
	}

	try {
		const result = await getAuthorDataBySource(pageTitle.trim(), source);
		return json(result);
	} catch (error) {
		console.error('Error fetching author details:', error);
		return json(
			{ success: false, error: 'Error occurred while fetching author details' },
			{ status: 500 }
		);
	}
};
