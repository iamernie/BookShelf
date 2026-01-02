import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupByIsbn, searchByName, isLookupError } from '$lib/server/services/bookLookupService';

export const GET: RequestHandler = async ({ url }) => {
	const isbn = url.searchParams.get('isbn');
	const query = url.searchParams.get('query') || url.searchParams.get('title');
	const maxResults = parseInt(url.searchParams.get('limit') || '10');

	if (isbn) {
		const result = await lookupByIsbn(isbn);

		if (isLookupError(result)) {
			throw error(400, result.error);
		}

		return json(result);
	}

	if (query) {
		const result = await searchByName(query, maxResults);

		if (isLookupError(result)) {
			throw error(404, result.error);
		}

		return json(result);
	}

	throw error(400, 'Please provide either an ISBN or a search query');
};
