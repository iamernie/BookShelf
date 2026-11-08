import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleBookTag, toggleSeriesTag, toggleAuthorTag } from '$lib/server/services/tagService';
import { canManageEntities } from '$lib/server/services/permissionService';
import { canEditBookCatalog, getBookAuthority } from '$lib/server/services/libraryShareService';

// Toggle a tag on a book, series, or author. The target is in the body, so the gate follows the
// parse: a book's tags are its catalog (canEditBookCatalog), series and author tags are entity edits
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.tagId) {
		throw error(400, { message: 'Tag ID is required' });
	}

	if (!data.bookId && !data.seriesId && !data.authorId) {
		throw error(400, { message: 'Either bookId, seriesId, or authorId is required' });
	}

	// Ensure only one entity type is specified
	const specifiedIds = [data.bookId, data.seriesId, data.authorId].filter(Boolean);
	if (specifiedIds.length > 1) {
		throw error(400, { message: 'Can only specify one of bookId, seriesId, or authorId' });
	}

	const tagId = parseInt(data.tagId);
	if (isNaN(tagId)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	if (data.bookId) {
		const bookId = parseInt(data.bookId);
		if (isNaN(bookId)) {
			throw error(400, { message: 'Invalid book ID' });
		}
		const book = await getBookAuthority(bookId);
		if (!book) {
			throw error(404, { message: 'Book not found' });
		}
		if (!(await canEditBookCatalog(locals.user, book))) {
			throw error(403, { message: 'You do not have permission to edit this book\'s tags' });
		}
		const result = await toggleBookTag(bookId, tagId);
		return json({ success: true, ...result });
	}

	if (data.seriesId) {
		const seriesId = parseInt(data.seriesId);
		if (isNaN(seriesId)) {
			throw error(400, { message: 'Invalid series ID' });
		}
		if (!canManageEntities(locals.user)) {
			throw error(403, { message: 'You do not have permission to edit series tags' });
		}
		const result = await toggleSeriesTag(seriesId, tagId);
		return json({ success: true, ...result });
	}

	if (data.authorId) {
		const authorId = parseInt(data.authorId);
		if (isNaN(authorId)) {
			throw error(400, { message: 'Invalid author ID' });
		}
		if (!canManageEntities(locals.user)) {
			throw error(403, { message: 'You do not have permission to edit author tags' });
		}
		const result = await toggleAuthorTag(authorId, tagId);
		return json({ success: true, ...result });
	}

	throw error(400, { message: 'Invalid request' });
};
