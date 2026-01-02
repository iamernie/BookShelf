/**
 * CBZ Page API
 *
 * Serves individual pages from a CBZ file as images.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getCbzPage } from '$lib/server/services/cbzService';

export const GET: RequestHandler = async ({ params }) => {
	const bookId = parseInt(params.id);
	const pageIndex = parseInt(params.page);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	if (isNaN(pageIndex) || pageIndex < 0) {
		throw error(400, 'Invalid page number');
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

	// Get the page
	const page = await getCbzPage(book.ebookPath, pageIndex);

	if (!page) {
		throw error(404, 'Page not found');
	}

	return new Response(new Uint8Array(page.data), {
		headers: {
			'Content-Type': page.mimeType,
			'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
		}
	});
};
