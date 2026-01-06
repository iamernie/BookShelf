/**
 * Kobo Book Metadata API
 *
 * GET /api/kobo/[token]/v1/library/[bookId]/metadata
 *
 * Returns metadata for a specific book.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';
import { generateBookMetadata } from '$lib/server/services/koboEntitlementService';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const { token, bookId } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book) or UUID (Kobo store book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		// Non-numeric ID - this would be a Kobo store book
		// For now, return empty array (proxy to Kobo store would go here)
		return json([]);
	}

	// Verify the book exists and belongs to this user
	const book = await db.query.books.findFirst({
		where: and(eq(books.id, numericId), eq(books.ownerId, user.userId))
	});

	if (!book) {
		throw error(404, 'Book not found');
	}

	const baseUrl = url.origin;
	const metadata = await generateBookMetadata(user.userId, numericId, baseUrl, token);

	if (!metadata) {
		throw error(404, 'Failed to generate metadata');
	}

	// Return as array (Kobo expects array)
	return json([metadata]);
};
