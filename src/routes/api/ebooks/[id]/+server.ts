/**
 * Ebook Management API
 *
 * DELETE /api/ebooks/[id] - Remove ebook from a book
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';
import { canModifyBook } from '$lib/server/services/libraryShareService';
import { deleteEbook } from '$lib/server/services/ebookService';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Same permission model as PUT /api/books/[id]
	if (book.libraryType === 'public') {
		if (!canManagePublicLibrary(locals.user)) {
			throw error(403, { message: 'Only librarians and admins can edit public library books' });
		}
	} else if (!(await canModifyBook(locals.user.id, bookId))) {
		throw error(403, { message: 'You do not have permission to modify this book' });
	}

	// Delete the ebook file
	if (book.ebookPath) {
		await deleteEbook(book.ebookPath);
	}

	// Clear ebook fields
	await db
		.update(books)
		.set({
			ebookPath: null,
			ebookFormat: null,
			readingProgress: null,
			lastReadAt: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(books.id, bookId));

	return json({
		success: true,
		message: 'Ebook removed successfully'
	});
};
