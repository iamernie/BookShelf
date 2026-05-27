/**
 * Cover Image Service
 * Handles downloading and storing book cover images
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import dns from 'dns/promises';

const COVERS_DIR = 'static/covers';

/**
 * Check if an IP address is private/internal
 * Prevents SSRF attacks by blocking requests to internal networks
 */
function isPrivateIP(ip: string): boolean {
	const privateIPv4Ranges = [
		/^127\./,
		/^10\./,
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./,
		/^192\.168\./,
		/^169\.254\./,
		/^0\./,
		/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
		/^192\.0\.0\./,
		/^192\.0\.2\./,
		/^198\.51\.100\./,
		/^203\.0\.113\./,
		/^224\./,
		/^240\./,
		/^255\.255\.255\.255$/
	];

	const privateIPv6Ranges = [
		/^::1$/,
		/^fe80:/i,
		/^fc00:/i,
		/^fd00:/i,
		/^ff00:/i
	];

	for (const range of privateIPv4Ranges) {
		if (range.test(ip)) return true;
	}

	for (const range of privateIPv6Ranges) {
		if (range.test(ip)) return true;
	}

	return false;
}

function isBlockedHostname(hostname: string): boolean {
	const blockedPatterns = [
		/^localhost$/i,
		/^.*\.local$/i,
		/^.*\.internal$/i,
		/^.*\.localdomain$/i,
		/^host\.docker\.internal$/i,
		/^kubernetes\.default/i,
		/^metadata\.google\.internal$/i,
		/^169\.254\.169\.254$/
	];

	return blockedPatterns.some(pattern => pattern.test(hostname));
}

async function validateUrlSafety(url: URL): Promise<void> {
	const hostname = url.hostname;

	if (isBlockedHostname(hostname)) {
		throw new Error('Invalid URL: blocked hostname');
	}

	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
	const ipv6Regex = /^\[?([a-fA-F0-9:]+)\]?$/;

	if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
		const ip = hostname.replace(/^\[|\]$/g, '');
		if (isPrivateIP(ip)) {
			throw new Error('Invalid URL: private IP addresses are not allowed');
		}
		return;
	}

	try {
		const addresses = await dns.resolve4(hostname).catch(() => []);
		const addresses6 = await dns.resolve6(hostname).catch(() => []);
		const allAddresses = [...addresses, ...addresses6];

		if (allAddresses.length === 0) {
			throw new Error('Invalid URL: could not resolve hostname');
		}

		for (const ip of allAddresses) {
			if (isPrivateIP(ip)) {
				throw new Error('Invalid URL: hostname resolves to private IP address');
			}
		}
	} catch (err) {
		if (err instanceof Error && err.message.startsWith('Invalid URL:')) {
			throw err;
		}
		throw new Error('Invalid URL: DNS resolution failed');
	}
}

async function ensureCoversDir() {
	if (!existsSync(COVERS_DIR)) {
		await mkdir(COVERS_DIR, { recursive: true });
	}
}

function getExtension(url: string, contentType: string): string {
	const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
	if (urlMatch) {
		return urlMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : urlMatch[1].toLowerCase();
	}

	const typeMap: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp'
	};

	return typeMap[contentType] || 'jpg';
}

function generateFilename(bookId: number | undefined, extension: string): string {
	const timestamp = Date.now();
	const random = randomBytes(8).toString('hex');
	if (bookId) {
		return `book_${bookId}_${timestamp}_${random}.${extension}`;
	}
	return `cover_${timestamp}_${random}.${extension}`;
}

/**
 * Download a cover image from a URL and save it locally
 * @param url The URL of the cover image
 * @param bookId Optional book ID to include in filename
 * @returns The local path to the saved cover image, or null if download failed
 */
export async function downloadCoverImage(url: string, bookId?: number): Promise<string | null> {
	if (!url) return null;

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			console.error('[coverService] Invalid protocol:', parsedUrl.protocol);
			return null;
		}
	} catch {
		console.error('[coverService] Invalid URL format:', url);
		return null;
	}

	try {
		await validateUrlSafety(parsedUrl);
	} catch (err) {
		console.error('[coverService] URL validation failed:', err);
		return null;
	}

	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Referer': 'https://books.google.com/'
			},
			redirect: 'follow'
		});

		if (!response.ok) {
			console.error('[coverService] Failed to fetch image:', response.statusText);
			return null;
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		if (!contentType.startsWith('image/')) {
			console.error('[coverService] URL does not point to an image:', contentType);
			return null;
		}

		const buffer = Buffer.from(await response.arrayBuffer());

		// Skip tiny placeholder images
		if (buffer.length < 1000) {
			console.error('[coverService] Image too small - likely a placeholder');
			return null;
		}

		// Check file size (max 10MB)
		if (buffer.length > 10 * 1024 * 1024) {
			console.error('[coverService] Image file too large');
			return null;
		}

		await ensureCoversDir();
		const extension = getExtension(url, contentType);
		const filename = generateFilename(bookId, extension);
		const filepath = join(COVERS_DIR, filename);

		await writeFile(filepath, buffer);

		return `/covers/${filename}`;
	} catch (err) {
		console.error('[coverService] Cover download error:', err);
		return null;
	}
}
