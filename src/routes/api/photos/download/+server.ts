import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const PHOTOS_DIR = 'static/photos';

// Ensure photos directory exists
async function ensurePhotosDir() {
	if (!existsSync(PHOTOS_DIR)) {
		await mkdir(PHOTOS_DIR, { recursive: true });
	}
}

// Get file extension from URL or content type
function getExtension(url: string, contentType: string): string {
	// Try to get from URL
	const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
	if (urlMatch) {
		return urlMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : urlMatch[1].toLowerCase();
	}

	// Fall back to content type
	const typeMap: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp'
	};

	return typeMap[contentType] || 'jpg';
}

// Generate unique filename
function generateFilename(type: 'author' | 'narrator', id: number | undefined, extension: string): string {
	const timestamp = Date.now();
	const random = randomBytes(8).toString('hex');
	if (id) {
		return `${type}_${id}_${timestamp}_${random}.${extension}`;
	}
	return `${type}_${timestamp}_${random}.${extension}`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { url, type, id } = body as { url: string; type: 'author' | 'narrator'; id?: number };

	if (!url) {
		throw error(400, 'URL is required');
	}

	if (!type || !['author', 'narrator'].includes(type)) {
		throw error(400, 'Type must be "author" or "narrator"');
	}

	// Validate URL format
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			throw new Error('Invalid protocol');
		}
	} catch {
		throw error(400, 'Invalid URL format');
	}

	try {
		// Fetch the image
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'BookShelf/2.0 (Photo downloader)',
				'Accept': 'image/*'
			}
		});

		if (!response.ok) {
			throw error(400, `Failed to fetch image: ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		if (!contentType.startsWith('image/')) {
			throw error(400, 'URL does not point to an image');
		}

		// Get image data
		const buffer = Buffer.from(await response.arrayBuffer());

		// Check file size (max 10MB)
		if (buffer.length > 10 * 1024 * 1024) {
			throw error(400, 'Image file too large (max 10MB)');
		}

		// Generate filename and save
		await ensurePhotosDir();
		const extension = getExtension(url, contentType);
		const filename = generateFilename(type, id, extension);
		const filepath = join(PHOTOS_DIR, filename);

		await writeFile(filepath, buffer);

		// Return the public path
		const photoPath = `/photos/${filename}`;

		return json({ success: true, photoPath });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Photo download error:', err);
		throw error(500, 'Failed to download photo');
	}
};
