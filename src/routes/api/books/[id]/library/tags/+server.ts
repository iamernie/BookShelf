/**
 * API: /api/books/[id]/library/tags
 * Manage user's personal tags for a book
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserBookTags,
	addUserBookTags,
	removeUserBookTags,
	setUserBookTags
} from '$lib/server/services/userBookService';

/**
 * GET /api/books/[id]/library/tags
 * Get user's personal tags for this book
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const tags = await getUserBookTags(locals.user.id, bookId);

	return json({ tags });
};

/**
 * POST /api/books/[id]/library/tags
 * Add tags to user's book
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const body = await request.json();
	const tagIds = body.tagIds as number[];

	if (!Array.isArray(tagIds) || tagIds.length === 0) {
		throw error(400, 'tagIds must be a non-empty array');
	}

	await addUserBookTags(locals.user.id, bookId, tagIds);
	const tags = await getUserBookTags(locals.user.id, bookId);

	return json({
		success: true,
		tags
	});
};

/**
 * PUT /api/books/[id]/library/tags
 * Set all tags for user's book (replaces existing)
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const body = await request.json();
	const tagIds = body.tagIds as number[];

	if (!Array.isArray(tagIds)) {
		throw error(400, 'tagIds must be an array');
	}

	await setUserBookTags(locals.user.id, bookId, tagIds);
	const tags = await getUserBookTags(locals.user.id, bookId);

	return json({
		success: true,
		tags
	});
};

/**
 * DELETE /api/books/[id]/library/tags
 * Remove tags from user's book
 */
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const body = await request.json();
	const tagIds = body.tagIds as number[];

	if (!Array.isArray(tagIds) || tagIds.length === 0) {
		throw error(400, 'tagIds must be a non-empty array');
	}

	await removeUserBookTags(locals.user.id, bookId, tagIds);
	const tags = await getUserBookTags(locals.user.id, bookId);

	return json({
		success: true,
		tags
	});
};
