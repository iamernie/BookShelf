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
import { canReachBook } from '$lib/server/services/libraryShareService';
import { applyStatusChange } from '$lib/server/services/statusService';
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

	// A book the user can't reach stays off their library list
	if (!(await canReachBook(locals.user.id, bookId))) {
		throw error(403, { message: 'You do not have access to this book' });
	}

	const body = await request.json().catch(() => ({}));

	// Already in their library: the fields sent update the row instead of being dropped
	if (await getUserBook(locals.user.id, bookId)) {
		const data: UpdateUserBookInput = {};
		if (body.rating === null || (typeof body.rating === 'number' && Number.isFinite(body.rating))) data.rating = body.rating;
		if (body.comments === null || typeof body.comments === 'string') data.comments = body.comments;
		if (Object.keys(data).length > 0) await updateUserBook(locals.user.id, bookId, data);
		// Status moves through applyStatusChange, as in PUT
		if (body.statusId === null || (typeof body.statusId === 'number' && Number.isInteger(body.statusId))) {
			await applyStatusChange([bookId], body.statusId, { source: 'book_edit', userId: locals.user.id });
		}
		return json({
			success: true,
			message: 'Book is already in your library',
			userBook: await getUserBook(locals.user.id, bookId)
		});
	}

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

const NUMBER_FIELDS = ['rating', 'readingProgress', 'dnfPage', 'dnfPercent'] as const;
const STRING_FIELDS = [
	'comments',
	'startReadingDate',
	'completedDate',
	'readingPosition',
	'dnfReason',
	'dnfDate'
] as const;

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

	const body: Record<string, unknown> = await request.json().catch(() => ({}));

	// Only these personal fields are editable here; never pass the raw body through
	const data: UpdateUserBookInput = {};
	for (const key of NUMBER_FIELDS) {
		const value = body[key];
		if (value === null || (typeof value === 'number' && Number.isFinite(value))) data[key] = value;
	}
	for (const key of STRING_FIELDS) {
		const value = body[key];
		if (value === null || typeof value === 'string') data[key] = value;
	}

	// Scoped to the caller's own row (userId + bookId); no row is created here
	let userBook = await updateUserBook(locals.user.id, bookId, data);

	if (!userBook) {
		throw error(404, 'Book not in your library');
	}

	// Status moves through applyStatusChange (date stamping, series status, notifications)
	const statusId = body.statusId;
	if (statusId === null || (typeof statusId === 'number' && Number.isInteger(statusId))) {
		const dates: { startReadingDate?: string; completedDate?: string } = {};
		if (data.startReadingDate) dates.startReadingDate = data.startReadingDate;
		if (data.completedDate) dates.completedDate = data.completedDate;
		await applyStatusChange([bookId], statusId, { source: 'book_edit', userId: locals.user.id, dates });
		userBook = (await getUserBook(locals.user.id, bookId)) ?? userBook;
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
 * Promote (personal -> public): the book's owner or an admin. Un-promote (public -> personal):
 * admins only. The owner is kept either way; an ownerless book un-promoted goes to the acting
 * admin, so it doesn't stay open to everyone as ownerless. Members' own rows are never touched:
 * anyone who added the book keeps it in their library after an un-promote.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
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

	const [book] = await db
		.select({ id: books.id, libraryType: books.libraryType, ownerId: books.ownerId })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	const isAdmin = locals.user.role === 'admin';
	if (libraryType === 'public') {
		if (!isAdmin && book.ownerId !== locals.user.id) {
			throw error(403, 'Only the book\'s owner or an admin can move it to the public library');
		}
	} else if (!isAdmin) {
		throw error(403, 'Only admins can move a book out of the public library');
	}

	if ((book.libraryType ?? 'personal') === libraryType) {
		return json({ success: true, libraryType });
	}

	const now = new Date().toISOString();
	const set: { libraryType: LibraryType; updatedAt: string; ownerId?: number } = { libraryType, updatedAt: now };
	if (libraryType === 'personal' && book.ownerId === null) set.ownerId = locals.user.id;

	await db
		.update(books)
		.set(set)
		.where(eq(books.id, bookId));

	// A new owner always has the book in their library, so they can read it
	if (set.ownerId !== undefined) {
		await addBookToUserLibrary({ userId: set.ownerId, bookId });
	}

	return json({
		success: true,
		libraryType
	});
};
