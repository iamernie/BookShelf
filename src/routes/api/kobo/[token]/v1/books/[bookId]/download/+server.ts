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

export const GET: RequestHandler = async ({ params, request }) => {
	const { token, bookId } = params;

	console.log('[Kobo Download] Request received:', {
		bookId,
		token: token.substring(0, 8) + '...',
		userAgent: request.headers.get('user-agent'),
		deviceId: request.headers.get('x-kobo-deviceid')
	});

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		console.log('[Kobo Download] Invalid token');
		throw error(401, 'Invalid or expired token');
	}

	console.log('[Kobo Download] User validated:', { userId: user.userId, syncEnabled: user.syncEnabled });

	if (!user.syncEnabled) {
		console.log('[Kobo Download] Sync disabled for user');
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		console.log('[Kobo Download] Non-numeric book ID:', bookId);
		// Non-numeric ID - proxy to Kobo store would go here
		throw error(404, 'Book not found');
	}

	// Get the book
	console.log('[Kobo Download] Looking up book:', { bookId: numericId, userId: user.userId });
	const book = await db.query.books.findFirst({
		where: and(eq(books.id, numericId), eq(books.ownerId, user.userId))
	});

	if (!book) {
		console.log('[Kobo Download] Book not found in database');
		throw error(404, 'Book not found');
	}

	console.log('[Kobo Download] Book found:', {
		id: book.id,
		title: book.title,
		ebookPath: book.ebookPath,
		ebookFormat: book.ebookFormat
	});

	if (!book.ebookPath) {
		console.log('[Kobo Download] Book has no ebook path');
		throw error(404, 'No ebook file available for this book');
	}

	// Construct the full file path
	const filePath = path.join(EBOOKS_PATH, book.ebookPath);
	console.log('[Kobo Download] Full file path:', filePath);
	console.log('[Kobo Download] EBOOKS_PATH env:', EBOOKS_PATH);

	if (!existsSync(filePath)) {
		console.log('[Kobo Download] ERROR: File does not exist at path');
		throw error(404, 'Ebook file not found');
	}

	// Get file stats
	const stats = statSync(filePath);
	const ext = path.extname(filePath).toLowerCase();

	console.log('[Kobo Download] File stats:', {
		size: stats.size,
		extension: ext
	});

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

	console.log('[Kobo Download] Sending file:', {
		filename,
		contentType,
		size: stats.size
	});

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
