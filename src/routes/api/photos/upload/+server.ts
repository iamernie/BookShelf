import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const PHOTOS_DIR = 'static/photos';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure photos directory exists
async function ensurePhotosDir() {
	if (!existsSync(PHOTOS_DIR)) {
		await mkdir(PHOTOS_DIR, { recursive: true });
	}
}

// Get extension from mime type
function getExtensionFromMime(mimeType: string): string {
	const typeMap: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp'
	};
	return typeMap[mimeType] || 'jpg';
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

	const formData = await request.formData();
	const file = formData.get('photo') as File | null;
	const type = formData.get('type') as string;
	const id = formData.get('id') as string | null;

	if (!file) {
		throw error(400, 'No photo file provided');
	}

	if (!type || !['author', 'narrator'].includes(type)) {
		throw error(400, 'Type must be "author" or "narrator"');
	}

	// Validate file type
	if (!file.type.startsWith('image/')) {
		throw error(400, 'File must be an image');
	}

	// Check file size
	if (file.size > MAX_SIZE) {
		throw error(400, 'Image file too large (max 10MB)');
	}

	try {
		// Get file data
		const buffer = Buffer.from(await file.arrayBuffer());

		// Generate filename and save
		await ensurePhotosDir();
		const extension = getExtensionFromMime(file.type);
		const filename = generateFilename(type as 'author' | 'narrator', id ? parseInt(id) : undefined, extension);
		const filepath = join(PHOTOS_DIR, filename);

		await writeFile(filepath, buffer);

		// Return the public path
		const photoPath = `/photos/${filename}`;

		return json({ success: true, photoPath });
	} catch (err) {
		console.error('Photo upload error:', err);
		throw error(500, 'Failed to upload photo');
	}
};
