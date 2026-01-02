import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname, resolve, normalize, relative } from 'path';

// MIME types for cover images
const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif'
};

/**
 * Serve cover images from static/covers directory
 * This is needed because adapter-node bundles static files at build time,
 * but covers are mounted at runtime via Docker volumes.
 */
export const GET: RequestHandler = async ({ params }) => {
	const requestedPath = params.path;

	if (!requestedPath) {
		throw error(400, 'No path specified');
	}

	// Sanitize and resolve path to prevent directory traversal
	// First, URL-decode the path, normalize it, then resolve against base directory
	const decodedPath = decodeURIComponent(requestedPath);
	const normalizedPath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');

	// Build the full file path using resolve for proper path canonicalization
	const coversDir = resolve(process.cwd(), 'static', 'covers');
	const filePath = resolve(coversDir, normalizedPath);

	// Security check: ensure the resolved path is within covers directory
	// Use relative path check to catch all traversal attempts
	const relativePath = relative(coversDir, filePath);
	if (relativePath.startsWith('..') || resolve(coversDir, relativePath) !== filePath) {
		throw error(403, 'Access denied');
	}

	// Check if file exists
	if (!existsSync(filePath)) {
		throw error(404, 'Cover not found');
	}

	// Get file stats for caching headers
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
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Last-Modified': stats.mtime.toUTCString()
		}
	});
};
