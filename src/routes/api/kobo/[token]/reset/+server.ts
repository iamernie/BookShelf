/**
 * Kobo Sync Reset Endpoint
 *
 * GET /api/kobo/[token]/reset
 * GET /api/kobo/[token]/reset?bookId=123
 *
 * Resets sync state for testing. Use bookId query param to reset specific book,
 * or omit to reset all sync state for the user.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';
import { db } from '$lib/server/db';
import { koboSyncState } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const { token } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	const bookIdParam = url.searchParams.get('bookId');
	const bookId = bookIdParam ? parseInt(bookIdParam, 10) : undefined;

	const now = new Date().toISOString();

	if (bookId && !isNaN(bookId)) {
		// Reset specific book
		await db
			.update(koboSyncState)
			.set({
				synced: false,
				removed: false,
				lastSyncedAt: null,
				updatedAt: now
			})
			.where(and(eq(koboSyncState.userId, user.userId), eq(koboSyncState.bookId, bookId)));

		return json({ message: `Reset sync state for book ${bookId}` });
	} else {
		// Reset all sync state for user
		await db
			.update(koboSyncState)
			.set({
				synced: false,
				removed: false,
				lastSyncedAt: null,
				updatedAt: now
			})
			.where(eq(koboSyncState.userId, user.userId));

		return json({ message: 'Reset all sync state for user' });
	}
};
