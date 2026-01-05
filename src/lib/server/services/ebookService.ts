/**
 * Ebook Service
 *
 * Handles ebook file uploads, metadata extraction, and file management.
 */

import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { join, extname, basename } from 'path';
import { randomBytes, createHash } from 'crypto';
import type { Readable } from 'stream';

// Configuration
const EBOOKS_DIR = 'static/ebooks';
const ALLOWED_EXTENSIONS = ['.epub', '.pdf', '.cbz'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Ensure ebooks directory exists
async function ensureEbooksDir() {
	if (!existsSync(EBOOKS_DIR)) {
		await mkdir(EBOOKS_DIR, { recursive: true });
	}
}

/**
 * Generate a safe filename for the ebook
 */
function generateFilename(originalName: string, bookId?: number): string {
	const ext = extname(originalName).toLowerCase();
	const timestamp = Date.now();
	const random = randomBytes(8).toString('hex');

	// Sanitize original name for prefix
	const baseName = basename(originalName, ext)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '_')
		.substring(0, 50);

	if (bookId) {
		return `book_${bookId}_${baseName}_${timestamp}_${random}${ext}`;
	}
	return `${baseName}_${timestamp}_${random}${ext}`;
}

/**
 * Validate ebook file
 */
function validateEbook(filename: string, size: number): { valid: boolean; error?: string } {
	const ext = extname(filename).toLowerCase();

	if (!ALLOWED_EXTENSIONS.includes(ext)) {
		return {
			valid: false,
			error: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed.`
		};
	}

	if (size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
		};
	}

	// Check for dangerous patterns
	const dangerousPatterns = ['.php', '.exe', '.sh', '.bat', '.cmd', '.js', '.html'];
	const lowerName = filename.toLowerCase();
	for (const pattern of dangerousPatterns) {
		if (lowerName.includes(pattern) && !lowerName.endsWith(ext)) {
			return { valid: false, error: 'File contains prohibited extension pattern.' };
		}
	}

	return { valid: true };
}

/**
 * Compute MD5 hash of a buffer (full file hash)
 * Note: This is NOT compatible with KOReader - use computeKoreaderMd5 instead
 */
export function computeMd5(buffer: Buffer): string {
	return createHash('md5').update(buffer).digest('hex');
}

/**
 * Compute KOReader-compatible partial MD5 hash
 *
 * This matches Booklore's proven Java implementation exactly.
 * Reads 1024-byte chunks at exponentially increasing offsets.
 *
 * Offsets: 1024, 4096, 16384, 65536, 262144, 1048576, ...
 * (calculated as 1024 << (2 * i) for i = 0 to 10)
 *
 * Reference: https://github.com/adityachandel/booklore (FileFingerprint.java)
 */
export function computeKoreaderMd5(buffer: Buffer): string {
	const md5 = createHash('md5');
	const blockSize = 1024;
	const base = 1024;

	// Match Booklore's Java implementation exactly
	// Start at i=0 (offset 1024) - this is proven to work with KOReader
	for (let i = 0; i <= 10; i++) {
		const offset = base << (2 * i); // 1024, 4096, 16384, 65536, ...

		if (offset >= buffer.length) {
			break;
		}

		// Read up to blockSize bytes from the offset
		const end = Math.min(offset + blockSize, buffer.length);
		const chunk = buffer.subarray(offset, end);

		if (chunk.length > 0) {
			md5.update(chunk);
		}
	}

	return md5.digest('hex');
}

/**
 * Compute MD5 hash of a file by path (full file hash)
 * Note: This is NOT compatible with KOReader - use computeFileKoreaderMd5 instead
 */
export async function computeFileMd5(filepath: string): Promise<string | null> {
	try {
		const buffer = await readFile(filepath);
		return computeMd5(buffer);
	} catch {
		return null;
	}
}

/**
 * Compute KOReader-compatible partial MD5 hash of a file by path
 */
export async function computeFileKoreaderMd5(filepath: string): Promise<string | null> {
	try {
		const buffer = await readFile(filepath);
		return computeKoreaderMd5(buffer);
	} catch {
		return null;
	}
}

/**
 * Save an ebook file
 */
export async function saveEbook(
	file: File,
	bookId?: number
): Promise<{ success: boolean; filename?: string; format?: string; md5?: string; error?: string }> {
	// Validate
	const validation = validateEbook(file.name, file.size);
	if (!validation.valid) {
		return { success: false, error: validation.error };
	}

	await ensureEbooksDir();

	const filename = generateFilename(file.name, bookId);
	const filepath = join(EBOOKS_DIR, filename);
	const format = extname(file.name).toLowerCase().replace('.', '');

	try {
		const buffer = Buffer.from(await file.arrayBuffer());

		// Compute KOReader-compatible partial MD5 hash for sync
		const md5 = computeKoreaderMd5(buffer);

		await writeFile(filepath, buffer);

		return {
			success: true,
			filename,
			format,
			md5
		};
	} catch (err) {
		console.error('Error saving ebook:', err);
		return { success: false, error: 'Failed to save ebook file' };
	}
}

/**
 * Delete an ebook file
 */
export async function deleteEbook(filename: string): Promise<boolean> {
	if (!filename) return false;

	// Prevent path traversal
	const safeName = basename(filename);
	const filepath = join(EBOOKS_DIR, safeName);

	try {
		if (existsSync(filepath)) {
			await unlink(filepath);
			return true;
		}
		return false;
	} catch (err) {
		console.error('Error deleting ebook:', err);
		return false;
	}
}

/**
 * Get ebook file path (validates it exists and is in the ebooks directory)
 * Handles both simple filenames and full paths from BookDrop imports
 */
export function getEbookPath(filename: string): string | null {
	if (!filename) return null;

	// Handle paths that start with /ebooks/ (from BookDrop's saveEbookFile)
	let normalizedPath = filename;
	if (filename.startsWith('/ebooks/')) {
		normalizedPath = filename.substring(8); // Remove /ebooks/ prefix
	} else if (filename.startsWith('/covers/')) {
		// Wrong path type
		return null;
	}

	// For simple filenames, use basename; for subdirectory paths, use as-is
	const filepath = normalizedPath.includes('/')
		? join(EBOOKS_DIR, normalizedPath)
		: join(EBOOKS_DIR, basename(normalizedPath));

	// Security check - make sure we're in the ebooks dir
	const resolvedPath = join(process.cwd(), filepath);
	const resolvedEbooksDir = join(process.cwd(), EBOOKS_DIR);
	if (!resolvedPath.startsWith(resolvedEbooksDir)) {
		return null;
	}

	if (!existsSync(filepath)) {
		return null;
	}

	return filepath;
}

/**
 * Check if an ebook exists
 */
export function ebookExists(filename: string): boolean {
	return getEbookPath(filename) !== null;
}

/**
 * Get ebook file as a readable stream
 */
export function getEbookStream(filename: string): Readable | null {
	const filepath = getEbookPath(filename);
	if (!filepath) return null;

	return createReadStream(filepath);
}

/**
 * Get content type for ebook format
 */
export function getContentType(format: string): string {
	const types: Record<string, string> = {
		epub: 'application/epub+zip',
		pdf: 'application/pdf',
		cbz: 'application/x-cbz'
	};
	return types[format.toLowerCase()] || 'application/octet-stream';
}

/**
 * Extract EPUB metadata using basic ZIP parsing
 * This is a simplified version - for full metadata extraction,
 * we'd use a dedicated EPUB library on the server side
 */
export async function extractEpubMetadata(filename: string): Promise<EpubMetadata | null> {
	const filepath = getEbookPath(filename);
	if (!filepath) return null;

	try {
		// For now, return null - full EPUB parsing requires additional dependencies
		// The client-side epub.js will handle the actual parsing
		return null;
	} catch (err) {
		console.error('Error extracting EPUB metadata:', err);
		return null;
	}
}

export interface EpubMetadata {
	title?: string;
	author?: string;
	authors?: string[];
	description?: string;
	publisher?: string;
	language?: string;
	isbn?: string;
	series?: string;
	seriesIndex?: number;
	publishDate?: string;
	subjects?: string[];
	coverImage?: string; // Base64 data URL
	coverMimeType?: string;
}

export interface ReadingProgress {
	location: string; // CFI for EPUB, page for PDF
	percentage: number;
	chapter?: string;
	currentPage?: number;
	totalPages?: number;
	savedAt: string;
}

/**
 * Parse reading progress from JSON string
 */
export function parseReadingProgress(json: string | null): ReadingProgress | null {
	if (!json) return null;

	try {
		return JSON.parse(json) as ReadingProgress;
	} catch {
		return null;
	}
}

/**
 * Stringify reading progress to JSON
 */
export function stringifyReadingProgress(progress: ReadingProgress): string {
	return JSON.stringify(progress);
}
