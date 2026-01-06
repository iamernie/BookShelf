/**
 * Kobo Debug Endpoint
 *
 * GET /api/kobo/[token]/debug
 *
 * Returns debug info about the Kobo sync state for troubleshooting.
 * This endpoint should be removed in production.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken, getKoboTagId, getKoboTaggedBooks, getUnsyncedBooks } from '$lib/server/services/koboService';
import { generateNewEntitlement } from '$lib/server/services/koboEntitlementService';
import { db } from '$lib/server/db';
import { books, bookTags, tags, koboSyncState } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const { token } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	// Get kobo tag info
	const koboTagId = await getKoboTagId();

	// Get all books with kobo tag (raw, no user filter) - including ebook info
	let allKoboTaggedBooks: { bookId: number; bookTitle: string; ownerId: number | null; ebookPath: string | null; ebookFormat: string | null }[] = [];
	if (koboTagId) {
		allKoboTaggedBooks = await db
			.select({
				bookId: bookTags.bookId,
				bookTitle: books.title,
				ownerId: books.ownerId,
				ebookPath: books.ebookPath,
				ebookFormat: books.ebookFormat
			})
			.from(bookTags)
			.innerJoin(books, eq(bookTags.bookId, books.id))
			.where(eq(bookTags.tagId, koboTagId));
	}

	// Get tagged books for this user (using the filter)
	const userTaggedBooks = await getKoboTaggedBooks(user.userId);

	// Get unsynced books
	const unsyncedBooks = await getUnsyncedBooks(user.userId, 100);

	// Get sync state for this user
	const syncStates = await db
		.select()
		.from(koboSyncState)
		.where(eq(koboSyncState.userId, user.userId));

	// Get all tags to verify "kobo" tag exists
	const allTags = await db.select({ id: tags.id, name: tags.name }).from(tags);

	// Test entitlement generation for first unsynced book
	let testEntitlement = null;
	let testEntitlementError = null;
	if (unsyncedBooks.length > 0) {
		try {
			const baseUrl = `https://bookshelf.ernieverse.net`;
			testEntitlement = await generateNewEntitlement(user.userId, unsyncedBooks[0], baseUrl, token);
		} catch (e) {
			testEntitlementError = e instanceof Error ? e.message : String(e);
		}
	}

	return json({
		userId: user.userId,
		syncEnabled: user.syncEnabled,
		koboTagId,
		allTags: allTags.slice(0, 20), // First 20 tags
		allKoboTaggedBooks,
		userTaggedBooks,
		unsyncedBooks,
		syncStates,
		testEntitlement: testEntitlement ? 'Generated successfully' : null,
		testEntitlementError,
		testEntitlementData: testEntitlement
	});
};
