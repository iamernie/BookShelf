/**
 * Ebook File Serving API
 *
 * GET /api/ebooks/[id]/file - Serve the ebook file for reading
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEbookStream, getContentType, ebookExists } from '$lib/server/services/ebookService';
import { basename } from 'path';

export const GET: RequestHandler = async ({ params }) => {
	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!book.ebookPath) {
		throw error(404, 'No ebook attached to this book');
	}

	if (!ebookExists(book.ebookPath)) {
		throw error(404, 'Ebook file not found');
	}

	const stream = getEbookStream(book.ebookPath);
	if (!stream) {
		throw error(500, 'Failed to read ebook file');
	}

	const contentType = getContentType(book.ebookFormat || 'epub');
	const filename = basename(book.ebookPath);

	// Convert Node.js stream to Web ReadableStream
	const webStream = new ReadableStream({
		start(controller) {
			stream.on('data', (chunk) => {
				controller.enqueue(chunk);
			});
			stream.on('end', () => {
				controller.close();
			});
			stream.on('error', (err) => {
				controller.error(err);
			});
		},
		cancel() {
			stream.destroy();
		}
	});

	return new Response(webStream, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `inline; filename="${filename}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
