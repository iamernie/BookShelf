/**
 * Kobo Thumbnail API
 *
 * GET /api/kobo/[token]/v1/books/[imageId]/thumbnail/[width]/[height]/false/image.jpg
 * GET /api/kobo/[token]/v1/books/[imageId]/thumbnail/[width]/[height]/[quality]/[isGreyscale]/image.jpg
 *
 * Returns book cover images for Kobo devices.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const COVERS_PATH = process.env.COVERS_PATH || './static/covers';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { token, imageId, width, height } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book) or external Kobo ID
	const numericId = parseInt(imageId, 10);

	if (!isNaN(numericId)) {
		// Local book - get cover from our storage
		const book = await db.query.books.findFirst({
			where: and(eq(books.id, numericId), eq(books.ownerId, user.userId))
		});

		if (!book || !book.coverImageUrl) {
			throw error(404, 'Cover not found');
		}

		// Try to find the cover file (coverImageUrl might be a relative path or URL)
		// If it starts with /covers/, extract the path
		let coverFilePath = book.coverImageUrl;
		if (coverFilePath.startsWith('/covers/')) {
			coverFilePath = coverFilePath.replace('/covers/', '');
		}
		const coverPath = path.join(COVERS_PATH, coverFilePath);

		if (!existsSync(coverPath)) {
			throw error(404, 'Cover file not found');
		}

		// Read and return the cover
		const coverData = readFileSync(coverPath);
		const ext = path.extname(coverPath).toLowerCase();

		let contentType = 'image/jpeg';
		if (ext === '.png') {
			contentType = 'image/png';
		} else if (ext === '.webp') {
			contentType = 'image/webp';
		}

		return new Response(coverData, {
			headers: {
				'Content-Type': contentType,
				'Content-Length': coverData.length.toString(),
				'Cache-Control': 'public, max-age=86400' // Cache for 1 day
			}
		});
	} else {
		// External Kobo image ID - proxy to Kobo CDN
		const cdnUrl = `https://cdn.kobo.com/book-images/${imageId}/${width}/${height}/image.jpg`;

		try {
			const response = await fetch(cdnUrl);
			if (!response.ok) {
				throw error(404, 'Image not found on Kobo CDN');
			}

			const imageData = await response.arrayBuffer();
			const contentType = response.headers.get('content-type') || 'image/jpeg';

			return new Response(imageData, {
				headers: {
					'Content-Type': contentType,
					'Content-Length': imageData.byteLength.toString(),
					'Cache-Control': 'public, max-age=86400'
				}
			});
		} catch {
			throw error(404, 'Failed to fetch image from Kobo CDN');
		}
	}
};
