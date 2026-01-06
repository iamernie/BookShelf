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
import { eq, and, or, isNull } from 'drizzle-orm';
import { getEbookStream, getContentType, ebookExists, getEbookPath } from '$lib/server/services/ebookService';
import { statSync } from 'fs';
import path from 'path';

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

	// Get the book - allow books owned by user OR unowned (for single-user setups)
	console.log('[Kobo Download] Looking up book:', { bookId: numericId, userId: user.userId });
	const book = await db.query.books.findFirst({
		where: and(
			eq(books.id, numericId),
			or(eq(books.ownerId, user.userId), isNull(books.ownerId))
		)
	});

	if (!book) {
		console.log('[Kobo Download] Book not found in database');
		throw error(404, 'Book not found');
	}

	console.log('[Kobo Download] Book found:', {
		id: book.id,
		title: book.title,
		ebookPath: book.ebookPath,
		ebookFormat: book.ebookFormat,
		ownerId: book.ownerId
	});

	if (!book.ebookPath) {
		console.log('[Kobo Download] Book has no ebook path');
		throw error(404, 'No ebook file available for this book');
	}

	// Use the ebookService to check if file exists (uses correct path resolution)
	if (!ebookExists(book.ebookPath)) {
		console.log('[Kobo Download] ERROR: File does not exist');
		console.log('[Kobo Download] ebookPath from DB:', book.ebookPath);
		console.log('[Kobo Download] Resolved path:', getEbookPath(book.ebookPath));
		throw error(404, 'Ebook file not found');
	}

	// Get the resolved file path for stats
	const filePath = getEbookPath(book.ebookPath);
	if (!filePath) {
		console.log('[Kobo Download] Could not resolve file path');
		throw error(404, 'Ebook file not found');
	}

	// Get file stats
	const stats = statSync(filePath);
	const ext = path.extname(filePath).toLowerCase();

	console.log('[Kobo Download] File stats:', {
		path: filePath,
		size: stats.size,
		extension: ext
	});

	// Get readable stream using ebookService
	const stream = getEbookStream(book.ebookPath);
	if (!stream) {
		console.log('[Kobo Download] Failed to create stream');
		throw error(500, 'Failed to read ebook file');
	}

	// Determine content type
	const contentType = getContentType(book.ebookFormat || 'epub');

	// Generate filename for download
	const safeTitle = (book.title || 'book').replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
	const filename = `${safeTitle}${ext}`;

	console.log('[Kobo Download] Sending file:', {
		filename,
		contentType,
		size: stats.size
	});

	// Convert Node stream to web stream
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
			'Content-Length': stats.size.toString(),
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
