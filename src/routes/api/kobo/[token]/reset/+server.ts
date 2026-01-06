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
		console.log(`[Kobo Reset] Resetting book ${bookId} for user ${user.userId}`);
		const result = await db
			.update(koboSyncState)
			.set({
				synced: false,
				removed: false,
				lastSyncedAt: null,
				updatedAt: now
			})
			.where(and(eq(koboSyncState.userId, user.userId), eq(koboSyncState.bookId, bookId)));

		console.log(`[Kobo Reset] Result:`, result);
		return json({ message: `Reset sync state for book ${bookId}`, userId: user.userId });
	} else {
		// Reset all sync state for user
		console.log(`[Kobo Reset] Resetting ALL books for user ${user.userId}`);
		const result = await db
			.update(koboSyncState)
			.set({
				synced: false,
				removed: false,
				lastSyncedAt: null,
				updatedAt: now
			})
			.where(eq(koboSyncState.userId, user.userId));

		console.log(`[Kobo Reset] Result:`, result);
		return json({ message: 'Reset all sync state for user', userId: user.userId });
	}
};
