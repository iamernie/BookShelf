import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname, resolve, normalize, relative } from 'path';
import { db, books } from '$lib/server/db';
import { like } from 'drizzle-orm';
import { canAccessBook } from '$lib/server/services/libraryShareService';

// MIME types for ebook files
const MIME_TYPES: Record<string, string> = {
	'.epub': 'application/epub+zip',
	'.pdf': 'application/pdf',
	'.mobi': 'application/x-mobipocket-ebook',
	'.azw': 'application/vnd.amazon.ebook',
	'.azw3': 'application/vnd.amazon.ebook',
	'.cbz': 'application/vnd.comicbook+zip',
	'.cbr': 'application/vnd.comicbook-rar'
};

/**
 * Serve ebook files from static/ebooks directory
 * This is needed because adapter-node bundles static files at build time,
 * but ebooks are mounted at runtime via Docker volumes.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Require authentication to access ebooks
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const requestedPath = params.path;

	if (!requestedPath) {
		throw error(400, 'No path specified');
	}

	// Sanitize and resolve path to prevent directory traversal
	// First, URL-decode the path, normalize it, then resolve against base directory
	const decodedPath = decodeURIComponent(requestedPath);
	const normalizedPath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');

	// Build the full file path using resolve for proper path canonicalization
	const ebooksDir = resolve(process.cwd(), 'static', 'ebooks');
	const filePath = resolve(ebooksDir, normalizedPath);

	// Security check: ensure the resolved path is within ebooks directory
	// Use relative path check to catch all traversal attempts
	const relativePath = relative(ebooksDir, filePath);
	if (relativePath.startsWith('..') || resolve(ebooksDir, relativePath) !== filePath) {
		throw error(403, 'Access denied');
	}

	// Check if file exists
	if (!existsSync(filePath)) {
		throw error(404, 'Ebook not found');
	}

	// Find the book that owns this ebook file and check access permissions
	const ebookPath = `/ebooks/${normalizedPath}`;
	const book = await db
		.select({ id: books.id })
		.from(books)
		.where(like(books.ebookPath, `%${normalizedPath}`))
		.limit(1);

	if (book.length > 0) {
		const hasAccess = await canAccessBook(locals.user.id, book[0].id);
		if (!hasAccess) {
			throw error(403, 'You do not have access to this ebook');
		}
	}
	// If no book found with this path, still serve it (might be an orphaned file or edge case)

	// Get file stats
	const stats = statSync(filePath);

	// Determine MIME type
	const ext = extname(filePath).toLowerCase();
	const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

	// Read and return the file
	const fileBuffer = readFileSync(filePath);

	return new Response(fileBuffer, {
		headers: {
			'Content-Type': mimeType,
			'Content-Length': stats.size.toString(),
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
