/**
 * OPDS Ebook Download Endpoint
 *
 * GET /opds/download/[id] - Download ebook file with Basic Auth
 *
 * This endpoint is specifically for OPDS clients that use Basic Auth.
 * Regular web users should use /api/ebooks/[id]/file instead.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEbookStream, getContentType, ebookExists } from '$lib/server/services/ebookService';
import { validateCredentials } from '$lib/server/services/authService';
import { basename } from 'path';

// Handle Basic Auth for OPDS
async function authenticateBasicAuth(request: Request): Promise<boolean> {
	const authHeader = request.headers.get('Authorization');

	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return false;
	}

	try {
		const base64Credentials = authHeader.slice(6);
		const credentials = atob(base64Credentials);
		const [email, password] = credentials.split(':');

		if (!email || !password) {
			return false;
		}

		const user = await validateCredentials(email, password);
		return !!user;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	// Verify Basic Auth
	const isAuthenticated = await authenticateBasicAuth(request);

	if (!isAuthenticated) {
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="BookShelf OPDS"',
				'Content-Type': 'text/plain'
			}
		});
	}

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
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
