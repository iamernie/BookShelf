/**
 * API: /api/metadata/extract
 * Extract metadata from uploaded ebook files
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ExtractedMetadata {
	title?: string;
	author?: string;
	description?: string;
	coverUrl?: string;
	isbn13?: string;
	isbn10?: string;
	publisher?: string;
	publishYear?: number;
	language?: string;
	fileType: 'ebook';
}

const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.cbz'];

function getFileExtension(filename: string): string {
	return filename.slice(filename.lastIndexOf('.')).toLowerCase();
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
	console.log('[metadata/extract] Extension:', ext, '| isEbook:', isEbook);

	if (!isEbook) {
		console.log('[metadata/extract] ERROR: Unsupported file type');
		throw error(400, 'Unsupported file type');
	}

	const metadata: ExtractedMetadata = {
		fileType: 'ebook'
	};

	try {
		if (ext === '.epub') {
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
