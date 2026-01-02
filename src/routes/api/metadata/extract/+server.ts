/**
 * API: /api/metadata/extract
 * Extract metadata from uploaded ebook or audiobook files
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseFile } from 'music-metadata';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { env } from '$env/dynamic/private';

// Timeout for metadata extraction (30 seconds)
const EXTRACTION_TIMEOUT_MS = 30000;

// Max file size for full metadata extraction (50MB)
// Larger files will get basic filename-based metadata
const MAX_FULL_EXTRACTION_SIZE = 50 * 1024 * 1024;

// Temp directory for processing
function getTempDir(): string {
	const dataPath = env.DATA_PATH || './data';
	const tempDir = join(dataPath, 'temp');
	if (!existsSync(tempDir)) {
		mkdirSync(tempDir, { recursive: true });
	}
	return tempDir;
}

interface ExtractedMetadata {
	title?: string;
	author?: string;
	narrator?: string;
	description?: string;
	coverUrl?: string;
	isbn13?: string;
	isbn10?: string;
	publisher?: string;
	publishYear?: number;
	language?: string;
	duration?: number;
	fileType: 'ebook' | 'audiobook';
}

const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.cbz'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.aac', '.ogg', '.opus', '.flac', '.wav'];

function getFileExtension(filename: string): string {
	return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

/**
 * Extract a reasonable title from a filename
 * Handles patterns like:
 * - "Edge World Undying Mercenaries, Book 14.mp3"
 * - "Author - Title.mp3"
 * - "Title (Series #1).mp3"
 */
function extractTitleFromFilename(filename: string): string {
	// Remove extension
	let title = filename.replace(/\.[^.]+$/, '');

	// Remove common audiobook suffixes
	title = title.replace(/[-_]\s*(audiobook|unabridged|abridged)$/i, '');

	// Clean up underscores and multiple spaces
	title = title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

	return title;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('[metadata/extract] === REQUEST RECEIVED ===');
	console.log('[metadata/extract] Content-Type:', request.headers.get('content-type'));
	console.log('[metadata/extract] Content-Length:', request.headers.get('content-length'));

	if (!locals.user) {
		console.log('[metadata/extract] ERROR: Unauthorized - no user in locals');
		throw error(401, 'Unauthorized');
	}
	console.log('[metadata/extract] User authenticated:', locals.user.id);

	console.log('[metadata/extract] Parsing formData...');
	let formData;
	try {
		formData = await request.formData();
		console.log('[metadata/extract] FormData parsed successfully');
	} catch (formError) {
		console.error('[metadata/extract] ERROR parsing formData:', formError);
		throw error(400, `Failed to parse form data: ${formError}`);
	}

	const file = formData.get('file') as File | null;

	if (!file) {
		console.log('[metadata/extract] ERROR: No file in formData');
		console.log('[metadata/extract] FormData keys:', [...formData.keys()]);
		throw error(400, 'No file provided');
	}

	console.log('[metadata/extract] File received:');
	console.log('[metadata/extract]   - Name:', file.name);
	console.log('[metadata/extract]   - Size:', file.size, 'bytes', `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
	console.log('[metadata/extract]   - Type:', file.type);

	const ext = getFileExtension(file.name);
	const isEbook = EBOOK_EXTENSIONS.includes(ext);
	const isAudio = AUDIO_EXTENSIONS.includes(ext);
	console.log('[metadata/extract] Extension:', ext, '| isEbook:', isEbook, '| isAudio:', isAudio);

	if (!isEbook && !isAudio) {
		console.log('[metadata/extract] ERROR: Unsupported file type');
		throw error(400, 'Unsupported file type');
	}

	const metadata: ExtractedMetadata = {
		fileType: isEbook ? 'ebook' : 'audiobook'
	};

	try {
		if (isAudio) {
			// For large audio files, skip full extraction to avoid timeouts
			// Just parse title from filename
			if (file.size > MAX_FULL_EXTRACTION_SIZE) {
				console.log(`[metadata/extract] Large file (${(file.size / 1024 / 1024).toFixed(1)}MB) > ${MAX_FULL_EXTRACTION_SIZE / 1024 / 1024}MB limit`);
				console.log('[metadata/extract] Using filename-based extraction (skipping audio parsing)');
				metadata.title = extractTitleFromFilename(file.name);
				console.log('[metadata/extract] Extracted title:', metadata.title);
				console.log('[metadata/extract] === RETURNING EARLY (large file) ===');
				return json(metadata);
			}

			// Extract metadata from audio file with timeout
			console.log('[metadata/extract] File is under size limit, will parse audio metadata');
			const tempDir = getTempDir();
			console.log('[metadata/extract] Temp directory:', tempDir);
			const tempPath = join(tempDir, `extract_${Date.now()}_${file.name}`);
			console.log('[metadata/extract] Temp file path:', tempPath);

			try {
				// Write file to temp location
				console.log('[metadata/extract] Reading file arrayBuffer...');
				const buffer = Buffer.from(await file.arrayBuffer());
				console.log('[metadata/extract] Buffer size:', buffer.length, 'bytes');
				console.log('[metadata/extract] Writing to temp file...');
				writeFileSync(tempPath, buffer);
				console.log('[metadata/extract] Temp file written successfully');

				// Parse audio metadata with timeout
				console.log('[metadata/extract] Starting audio metadata parse (timeout:', EXTRACTION_TIMEOUT_MS, 'ms)...');
				const audioMeta = await Promise.race([
					parseFile(tempPath),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Metadata extraction timeout')), EXTRACTION_TIMEOUT_MS)
					)
				]);
				console.log('[metadata/extract] Audio metadata parsed successfully');

				if (audioMeta.common) {
					console.log('[metadata/extract] Common metadata found');
					metadata.title = audioMeta.common.title || audioMeta.common.album;
					metadata.author = audioMeta.common.artist || audioMeta.common.albumartist;

					// Handle comment which can be string or IComment object
					const comment = audioMeta.common.comment?.[0];
					if (comment) {
						metadata.description = typeof comment === 'string' ? comment : comment.text;
					}

					// For audiobooks, the "artist" is often the author, and "composer" might be narrator
					// Or in some cases, "artist" field might have "Author / Narrator" format
					const artist = audioMeta.common.artist || '';
					if (artist.includes('/')) {
						const parts = artist.split('/').map(s => s.trim());
						metadata.author = parts[0];
						if (parts[1]) metadata.narrator = parts[1];
					}

					// Check for dedicated narrator fields
					// composer can be string or string[]
					const composer = audioMeta.common.composer;
					if (composer) {
						const narratorValue = Array.isArray(composer) ? composer[0] : composer;
						metadata.narrator = metadata.narrator || narratorValue;
					}
				} else {
					console.log('[metadata/extract] No common metadata found in audio file');
				}

				if (audioMeta.format) {
					metadata.duration = audioMeta.format.duration;
					console.log('[metadata/extract] Duration:', metadata.duration, 'seconds');
				}

			} finally {
				// Clean up temp file
				console.log('[metadata/extract] Cleaning up temp file...');
				try {
					unlinkSync(tempPath);
					console.log('[metadata/extract] Temp file deleted');
				} catch (cleanupErr) {
					console.log('[metadata/extract] Temp file cleanup failed (may not exist):', cleanupErr);
				}
			}
		} else if (ext === '.epub') {
			// For EPUB, we'd need to parse the container.xml and content.opf
			// This is more complex - for now, try to extract from filename
			const filename = file.name.replace(/\.epub$/i, '');

			// Try to parse common filename patterns:
			// "Author - Title.epub"
			// "Title - Author.epub"
			// "Title (Series #1) - Author.epub"
			if (filename.includes(' - ')) {
				const parts = filename.split(' - ');
				if (parts.length >= 2) {
					// Assume "Author - Title" format
					metadata.author = parts[0].trim();
					metadata.title = parts.slice(1).join(' - ').trim();
				}
			} else {
				metadata.title = filename;
			}

			// TODO: Add proper EPUB parsing with jszip + xml parsing
			// For now, basic filename parsing is a reasonable fallback
		}

		console.log('[metadata/extract] === EXTRACTION COMPLETE ===');
		console.log('[metadata/extract] Final metadata:', JSON.stringify(metadata, null, 2));
		return json(metadata);

	} catch (err) {
		console.error('[metadata/extract] === EXTRACTION ERROR ===');
		console.error('[metadata/extract] Error:', err);
		console.error('[metadata/extract] Stack:', err instanceof Error ? err.stack : 'no stack');
		// Return empty metadata rather than failing - user can fill in manually
		console.log('[metadata/extract] Returning partial metadata due to error');
		return json(metadata);
	}
};
