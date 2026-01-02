/**
 * Book Media Sources API
 *
 * GET /api/books/[id]/media-sources - Get all media sources for a book
 * POST /api/books/[id]/media-sources - Add a media source to a book
 * PUT /api/books/[id]/media-sources - Set all media sources for a book (replaces existing)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBookMediaSources, addBookMediaSource, setBookMediaSources } from '$lib/server/services/mediaSourceService';
import { getBookById } from '$lib/server/services/bookService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const sources = await getBookMediaSources(bookId);
	return json(sources);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Verify book exists
	const book = await getBookById(bookId);
	if (!book) {
		throw error(404, 'Book not found');
	}

	const data = await request.json();

	if (!data.mediaSourceId || typeof data.mediaSourceId !== 'number') {
		throw error(400, 'mediaSourceId is required');
	}

	try {
		const entry = await addBookMediaSource(bookId, data.mediaSourceId, {
			purchaseDate: data.purchaseDate,
			purchasePrice: data.purchasePrice,
			externalUrl: data.externalUrl,
			externalId: data.externalId,
			notes: data.notes
		});

		return json(entry, { status: 201 });
	} catch (e) {
		if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
			throw error(400, 'This media source is already associated with this book');
		}
		throw e;
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Verify book exists
	const book = await getBookById(bookId);
	if (!book) {
		throw error(404, 'Book not found');
	}

	const data = await request.json();

	if (!Array.isArray(data.sources)) {
		throw error(400, 'sources array is required');
	}

	const sources = await setBookMediaSources(bookId, data.sources);
	return json(sources);
};
