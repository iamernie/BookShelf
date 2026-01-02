import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { autocomplete } from '$lib/server/services/searchService';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';

	try {
		const results = await autocomplete(query);
		return json(results);
	} catch (error) {
		console.error('Search autocomplete error:', error);
		return json({ books: [], authors: [], series: [], narrators: [] });
	}
};
