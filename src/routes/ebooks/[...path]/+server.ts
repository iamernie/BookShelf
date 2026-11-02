import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname, resolve, normalize, relative } from 'path';
import { db, books } from '$lib/server/db';
import { inArray } from 'drizzle-orm';
import { canReadEbook } from '$lib/server/services/libraryShareService';

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
	// The path param is already URL-decoded: normalize it, then resolve against base directory
	const normalizedPath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');

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

	// Find the books stored at this exact path, in either stored form. Matching the canonical
	// path means a request can't dodge the lookup with a trailing slash or a '/.'
	const owners = await db
		.select({ id: books.id })
		.from(books)
		.where(inArray(books.ebookPath, [relativePath, `/ebooks/${relativePath}`]));

	if (owners.length > 0) {
		let hasAccess = false;
		for (const owner of owners) {
			hasAccess = await canReadEbook(locals.user, owner.id);
			if (hasAccess) break;
		}
		if (!hasAccess) {
			throw error(403, 'You do not have access to this ebook');
		}
	} else if (locals.user.role !== 'admin') {
		// An orphaned file has no book to check access against
		throw error(404, 'Ebook not found');
	}

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
