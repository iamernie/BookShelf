/**
 * CBZ Service
 *
 * Handles CBZ (Comic Book ZIP) file extraction and page serving.
 * CBZ files are ZIP archives containing sequential images.
 */

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { getEbookPath } from './ebookService';

// In-memory cache for extracted CBZ metadata
// In production, this could be stored in the database or on disk
const cbzCache = new Map<string, CbzMetadata>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export interface CbzPage {
	index: number;
	filename: string;
	mimeType: string;
}

export interface CbzMetadata {
	filename: string;
	pages: CbzPage[];
	totalPages: number;
	cachedAt: number;
}

// Supported image extensions for comics
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Natural sort function for page filenames
 * Handles: page1.jpg, page2.jpg, page10.jpg correctly
 */
function naturalSort(a: string, b: string): number {
	const regex = /(\d+)|(\D+)/g;
	const partsA = a.match(regex) || [];
	const partsB = b.match(regex) || [];

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const partA = partsA[i] || '';
		const partB = partsB[i] || '';

		const numA = parseInt(partA);
		const numB = parseInt(partB);

		if (!isNaN(numA) && !isNaN(numB)) {
			if (numA !== numB) return numA - numB;
		} else {
			if (partA !== partB) return partA.localeCompare(partB);
		}
	}

	return 0;
}

/**
 * Get MIME type from extension
 */
function getMimeType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	const mimeTypes: Record<string, string> = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.bmp': 'image/bmp'
	};
	return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Check if a filename is an image we can display
 */
function isImageFile(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	// Skip hidden files and macOS metadata
	if (basename(filename).startsWith('.') || filename.includes('__MACOSX')) {
		return false;
	}
	return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Extract CBZ metadata (page list, count) without loading all images
 */
export async function getCbzMetadata(ebookPath: string): Promise<CbzMetadata | null> {
	const filepath = getEbookPath(ebookPath);
	if (!filepath) return null;

	// Check cache
	const cacheKey = ebookPath;
	const cached = cbzCache.get(cacheKey);
	if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
		return cached;
	}

	try {
		const fileBuffer = await readFile(filepath);
		const zip = await JSZip.loadAsync(fileBuffer);

		// Get all image files and sort them naturally
		const imageFiles: string[] = [];

		zip.forEach((relativePath, file) => {
			if (!file.dir && isImageFile(relativePath)) {
				imageFiles.push(relativePath);
			}
		});

		// Sort pages naturally (page1, page2, ..., page10)
		imageFiles.sort(naturalSort);

		// Create page metadata
		const pages: CbzPage[] = imageFiles.map((filename, index) => ({
			index,
			filename,
			mimeType: getMimeType(filename)
		}));

		const metadata: CbzMetadata = {
			filename: ebookPath,
			pages,
			totalPages: pages.length,
			cachedAt: Date.now()
		};

		cbzCache.set(cacheKey, metadata);
		return metadata;
	} catch (err) {
		console.error('Error reading CBZ metadata:', err);
		return null;
	}
}

/**
 * Extract a single page from a CBZ file
 */
export async function getCbzPage(
	ebookPath: string,
	pageIndex: number
): Promise<{ data: Buffer; mimeType: string } | null> {
	const filepath = getEbookPath(ebookPath);
	if (!filepath) return null;

	try {
		const metadata = await getCbzMetadata(ebookPath);
		if (!metadata || pageIndex < 0 || pageIndex >= metadata.totalPages) {
			return null;
		}

		const page = metadata.pages[pageIndex];
		const fileBuffer = await readFile(filepath);
		const zip = await JSZip.loadAsync(fileBuffer);

		const imageFile = zip.file(page.filename);
		if (!imageFile) return null;

		const data = await imageFile.async('nodebuffer');

		return {
			data,
			mimeType: page.mimeType
		};
	} catch (err) {
		console.error('Error extracting CBZ page:', err);
		return null;
	}
}

/**
 * Clear cached metadata for a specific file
 */
export function clearCbzCache(ebookPath: string): void {
	cbzCache.delete(ebookPath);
}

/**
 * Clear all cached metadata (useful for memory management)
 */
export function clearAllCbzCache(): void {
	cbzCache.clear();
}
