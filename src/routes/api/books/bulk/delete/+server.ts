import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books, bookAuthors, bookSeries, bookTags, userBooks, userBookTags, metadataSuggestions, readingSessions, bookdropQueue } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// Fetch books to get file paths for cleanup
	const booksToDelete = await db
		.select({
			id: books.id,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath
		})
		.from(books)
		.where(inArray(books.id, bookIds));

	// Delete associated files
	const coversPath = process.env.COVERS_PATH || './static/covers';
	const ebooksPath = process.env.EBOOKS_PATH || './static/ebooks';

	for (const book of booksToDelete) {
		// Delete cover image if it's a local file
		if (book.coverImageUrl && book.coverImageUrl.startsWith('/covers/')) {
			const coverFile = path.join(coversPath, path.basename(book.coverImageUrl));
			try {
				if (existsSync(coverFile)) {
					await unlink(coverFile);
				}
			} catch (e) {
				console.error(`Failed to delete cover file: ${coverFile}`, e);
			}
		}

		// Delete ebook file
		if (book.ebookPath) {
			const ebookFile = path.join(ebooksPath, path.basename(book.ebookPath));
			try {
				if (existsSync(ebookFile)) {
					await unlink(ebookFile);
				}
			} catch (e) {
				console.error(`Failed to delete ebook file: ${ebookFile}`, e);
			}
		}
	}

	// Delete related records (should cascade, but being explicit)
	await db.delete(bookAuthors).where(inArray(bookAuthors.bookId, bookIds));
	await db.delete(bookSeries).where(inArray(bookSeries.bookId, bookIds));
	await db.delete(bookTags).where(inArray(bookTags.bookId, bookIds));
	await db.delete(userBooks).where(inArray(userBooks.bookId, bookIds));
	await db.delete(userBookTags).where(inArray(userBookTags.bookId, bookIds));
	await db.delete(metadataSuggestions).where(inArray(metadataSuggestions.bookId, bookIds));
	await db.delete(readingSessions).where(inArray(readingSessions.bookId, bookIds));
	await db.delete(bookdropQueue).where(inArray(bookdropQueue.bookId, bookIds));

	// Delete books
	const result = await db.delete(books).where(inArray(books.id, bookIds));

	return json({
		success: true,
		deleted: bookIds.length,
		message: `Deleted ${bookIds.length} book(s)`
	});
};
