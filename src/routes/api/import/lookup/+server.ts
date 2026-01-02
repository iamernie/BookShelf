/**
 * Book Lookup API for Import
 * GET - Search by ISBN or title
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	lookupByIsbn,
	searchByName,
	getBookDetails,
	isLookupError,
	type BookSearchResult
} from '$lib/server/services/bookLookupService';

export const GET: RequestHandler = async ({ url }) => {
	const isbn = url.searchParams.get('isbn');
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '10');

	if (isbn) {
		const result = await lookupByIsbn(isbn);

		if (isLookupError(result)) {
			throw error(404, result.error);
		}

		return json(result);
	}

	if (query) {
		const results = await searchByName(query, limit);

		if (isLookupError(results)) {
			throw error(404, results.error);
		}

		return json(results);
	}

	throw error(400, 'Please provide an ISBN or search query');
};

/**
 * POST - Get full details for a search result
 */
export const POST: RequestHandler = async ({ request }) => {
	const book: BookSearchResult = await request.json();

	if (!book || !book.source) {
		throw error(400, 'Invalid book data');
	}

	const result = await getBookDetails(book);

	if (isLookupError(result)) {
		throw error(404, result.error);
	}

	return json(result);
};
