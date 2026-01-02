/**
 * API: /api/books/[id]/library
 * Manage a book's library type and user's personal library association.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import {
	addBookToUserLibrary,
	removeBookFromUserLibrary,
	getUserBook,
	updateUserBook,
	type UpdateUserBookInput
} from '$lib/server/services/userBookService';
// Permission service used for full User type - for simplified locals.user, check role directly
import type { LibraryType } from '$lib/server/db/schema';

/**
 * GET /api/books/[id]/library
 * Get user's relationship with this book (is it in their library? personal data?)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Get the book's library type
	const [book] = await db
		.select({ id: books.id, libraryType: books.libraryType })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Get user's personal data for this book
	const userBook = await getUserBook(locals.user.id, bookId);

	return json({
		bookId,
		libraryType: book.libraryType,
		inUserLibrary: !!userBook,
		userBook: userBook || null
	});
};

/**
 * POST /api/books/[id]/library
 * Add a book to the user's personal library
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Check if book exists
	const [book] = await db
		.select({ id: books.id })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	const body = await request.json().catch(() => ({}));

	// Add to user's library
	const userBook = await addBookToUserLibrary({
		userId: locals.user.id,
		bookId,
		statusId: body.statusId,
		rating: body.rating,
		comments: body.comments
	});

	return json({
		success: true,
		message: 'Book added to your library',
		userBook
	});
};

/**
 * PUT /api/books/[id]/library
 * Update user's personal data for a book
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const body = (await request.json()) as UpdateUserBookInput;

	const userBook = await updateUserBook(locals.user.id, bookId, body);

	if (!userBook) {
		throw error(404, 'Book not in your library');
	}

	return json({
		success: true,
		userBook
	});
};

/**
 * DELETE /api/books/[id]/library
 * Remove a book from the user's personal library
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	await removeBookFromUserLibrary(locals.user.id, bookId);

	return json({
		success: true,
		message: 'Book removed from your library'
	});
};

/**
 * PATCH /api/books/[id]/library
 * Change the book's library type (personal <-> public)
 * Requires librarian/admin permission
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Check for librarian/admin permission (manually check role since locals.user is simplified)
	const userRole = locals.user.role;
	if (userRole !== 'admin' && userRole !== 'librarian') {
		throw error(403, 'Insufficient permissions to manage library type');
	}

	const bookId = parseInt(params.id);
	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const body = await request.json();
	const libraryType = body.libraryType as LibraryType;

	if (!libraryType || !['personal', 'public'].includes(libraryType)) {
		throw error(400, 'Invalid library type. Must be "personal" or "public"');
	}

	const now = new Date().toISOString();

	await db
		.update(books)
		.set({ libraryType, updatedAt: now })
		.where(eq(books.id, bookId));

	return json({
		success: true,
		libraryType
	});
};
