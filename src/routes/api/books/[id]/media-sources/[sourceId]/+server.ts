/**
 * Book Media Source by ID API
 *
 * DELETE /api/books/[id]/media-sources/[sourceId] - Remove a media source from a book
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeBookMediaSource } from '$lib/server/services/mediaSourceService';
import { canEditBookCatalog, getBookAuthority } from '$lib/server/services/libraryShareService';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const bookId = parseInt(params.id);
	const sourceId = parseInt(params.sourceId);

	if (isNaN(bookId) || isNaN(sourceId)) {
		throw error(400, 'Invalid IDs');
	}

	// Media sources are shared per book: removing one needs the book's catalog authority
	const book = await getBookAuthority(bookId);
	if (!book) {
		throw error(404, 'Book not found');
	}
	if (!(await canEditBookCatalog(locals.user, book))) {
		throw error(403, { message: 'You do not have permission to change this book\'s media sources' });
	}

	await removeBookMediaSource(bookId, sourceId);
	return json({ success: true });
};
