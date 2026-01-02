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
import { deleteEbook } from '$lib/server/services/ebookService';

export const DELETE: RequestHandler = async ({ params }) => {
	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
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
