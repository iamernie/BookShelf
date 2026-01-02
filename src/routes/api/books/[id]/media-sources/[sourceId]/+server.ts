/**
 * Book Media Source by ID API
 *
 * DELETE /api/books/[id]/media-sources/[sourceId] - Remove a media source from a book
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeBookMediaSource } from '$lib/server/services/mediaSourceService';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const bookId = parseInt(params.id);
	const sourceId = parseInt(params.sourceId);

	if (isNaN(bookId) || isNaN(sourceId)) {
		throw error(400, 'Invalid IDs');
	}

	await removeBookMediaSource(bookId, sourceId);
	return json({ success: true });
};
