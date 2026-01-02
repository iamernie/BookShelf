import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

// MIME types for photos
const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif'
};

/**
 * Serve author/narrator photos from static/photos directory
 * This is needed because adapter-node bundles static files at build time,
 * but photos are uploaded at runtime.
 */
export const GET: RequestHandler = async ({ params }) => {
	const requestedPath = params.path;

	if (!requestedPath) {
		throw error(400, 'No path specified');
	}

	// Sanitize path to prevent directory traversal
	const sanitizedPath = requestedPath.replace(/\.\./g, '').replace(/\/+/g, '/');

	// Build the full file path
	const photosDir = join(process.cwd(), 'static', 'photos');
	const filePath = join(photosDir, sanitizedPath);

	// Security check: ensure the resolved path is within photos directory
	if (!filePath.startsWith(photosDir)) {
		throw error(403, 'Access denied');
	}

	// Check if file exists
	if (!existsSync(filePath)) {
		throw error(404, 'Photo not found');
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
