/**
 * Kobo Book Download API
 *
 * GET /api/kobo/[token]/v1/books/[bookId]/download
 *
 * Downloads an ebook file for a Kobo device.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createReadStream, existsSync, statSync } from 'fs';
import { Readable } from 'stream';
import path from 'path';

const EBOOKS_PATH = process.env.EBOOKS_PATH || './data/ebooks';

export const GET: RequestHandler = async ({ params }) => {
	const { token, bookId } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		// Non-numeric ID - proxy to Kobo store would go here
		throw error(404, 'Book not found');
	}

	// Get the book
	const book = await db.query.books.findFirst({
		where: and(eq(books.id, numericId), eq(books.ownerId, user.userId))
	});

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!book.ebookPath) {
		throw error(404, 'No ebook file available for this book');
	}

	// Construct the full file path
	const filePath = path.join(EBOOKS_PATH, book.ebookPath);

	if (!existsSync(filePath)) {
		throw error(404, 'Ebook file not found');
	}

	// Get file stats
	const stats = statSync(filePath);
	const ext = path.extname(filePath).toLowerCase();

	// Determine content type
	let contentType = 'application/octet-stream';
	if (ext === '.epub') {
		contentType = 'application/epub+zip';
	} else if (ext === '.kepub' || ext === '.kepub.epub') {
		contentType = 'application/epub+zip';
	} else if (ext === '.pdf') {
		contentType = 'application/pdf';
	}

	// Create readable stream
	const fileStream = createReadStream(filePath);

	// Generate filename for download
	const safeTitle = (book.title || 'book').replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
	const filename = `${safeTitle}${ext}`;

	// Convert Node stream to web stream
	const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

	return new Response(webStream, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': stats.size.toString(),
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
