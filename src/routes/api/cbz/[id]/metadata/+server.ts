/**
 * CBZ Metadata API
 *
 * Returns metadata about a CBZ file (page count, etc.)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getCbzMetadata } from '$lib/server/services/cbzService';

export const GET: RequestHandler = async ({ params }) => {
	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Get book from database
	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!book.ebookPath) {
		throw error(404, 'No ebook file attached to this book');
	}

	if (book.ebookFormat?.toLowerCase() !== 'cbz') {
		throw error(400, 'Book is not a CBZ file');
	}

	// Get CBZ metadata
	const metadata = await getCbzMetadata(book.ebookPath);

	if (!metadata) {
		throw error(500, 'Failed to read CBZ file');
	}

	return json({
		bookId,
		totalPages: metadata.totalPages,
		pages: metadata.pages.map((p) => ({
			index: p.index,
			filename: p.filename
		}))
	});
};
