import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
	// IPv4 private ranges
	const privateIPv4Ranges = [
		/^127\./,                          // Loopback
		/^10\./,                           // Class A private
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Class B private
		/^192\.168\./,                     // Class C private
		/^169\.254\./,                     // Link-local
		/^0\./,                            // Current network
		/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
		/^192\.0\.0\./,                    // IETF Protocol Assignments
		/^192\.0\.2\./,                    // TEST-NET-1
		/^198\.51\.100\./,                 // TEST-NET-2
		/^203\.0\.113\./,                  // TEST-NET-3
		/^224\./,                          // Multicast
		/^240\./,                          // Reserved
		/^255\.255\.255\.255$/             // Broadcast
	];

	// IPv6 private ranges
	const privateIPv6Ranges = [
		/^::1$/,                           // Loopback
		/^fe80:/i,                         // Link-local
		/^fc00:/i,                         // Unique local
		/^fd00:/i,                         // Unique local
		/^ff00:/i                          // Multicast
	];

	// Check IPv4
	for (const range of privateIPv4Ranges) {
		if (range.test(ip)) {
			return true;
		}
	}

	// Check IPv6
	for (const range of privateIPv6Ranges) {
		if (range.test(ip)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if a hostname is blocked (localhost variants, internal names)
 */
function isBlockedHostname(hostname: string): boolean {
	const blockedPatterns = [
		/^localhost$/i,
		/^.*\.local$/i,
		/^.*\.internal$/i,
		/^.*\.localdomain$/i,
		/^host\.docker\.internal$/i,
		/^kubernetes\.default/i,
		/^metadata\.google\.internal$/i,  // GCP metadata
		/^169\.254\.169\.254$/             // AWS/GCP/Azure metadata
	];

	return blockedPatterns.some(pattern => pattern.test(hostname));
}

/**
 * Validate URL and resolve DNS to check for SSRF
 */
async function validateUrlSafety(url: URL): Promise<void> {
	const hostname = url.hostname;

	// Check for blocked hostnames
	if (isBlockedHostname(hostname)) {
		throw error(400, 'Invalid URL: blocked hostname');
	}

	// Check if hostname is already an IP address
	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
	const ipv6Regex = /^\[?([a-fA-F0-9:]+)\]?$/;

	if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
		const ip = hostname.replace(/^\[|\]$/g, '');
		if (isPrivateIP(ip)) {
			throw error(400, 'Invalid URL: private IP addresses are not allowed');
		}
		return;
	}

	// Resolve DNS to get IP addresses and check each one
	try {
		const addresses = await dns.resolve4(hostname).catch(() => []);
		const addresses6 = await dns.resolve6(hostname).catch(() => []);
		const allAddresses = [...addresses, ...addresses6];

		if (allAddresses.length === 0) {
			throw error(400, 'Invalid URL: could not resolve hostname');
		}

		for (const ip of allAddresses) {
			if (isPrivateIP(ip)) {
				throw error(400, 'Invalid URL: hostname resolves to private IP address');
			}
		}
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		throw error(400, 'Invalid URL: DNS resolution failed');
	}
}

// Ensure covers directory exists
async function ensureCoversDir() {
	if (!existsSync(COVERS_DIR)) {
		await mkdir(COVERS_DIR, { recursive: true });
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
function generateFilename(bookId: number | undefined, extension: string): string {
	const timestamp = Date.now();
	const random = randomBytes(8).toString('hex');
	if (bookId) {
		return `book_${bookId}_${timestamp}_${random}.${extension}`;
	}
	return `cover_${timestamp}_${random}.${extension}`;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { url, bookId } = body as { url: string; bookId?: number };

	if (!url) {
		throw error(400, 'URL is required');
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

	// Validate URL safety to prevent SSRF attacks
	await validateUrlSafety(parsedUrl);

	try {
		// Fetch the image
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'BookShelf/2.0 (Book cover downloader)',
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
		await ensureCoversDir();
		const extension = getExtension(url, contentType);
		const filename = generateFilename(bookId, extension);
		const filepath = join(COVERS_DIR, filename);

		await writeFile(filepath, buffer);

		// Return the public path
		const coverPath = `/covers/${filename}`;

		return json({ success: true, coverPath });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Cover download error:', err);
		throw error(500, 'Failed to download cover image');
	}
};
