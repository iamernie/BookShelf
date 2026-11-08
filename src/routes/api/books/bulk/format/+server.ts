import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { inArray } from 'drizzle-orm';
import { canEditBookCatalog, partitionBooks } from '$lib/server/services/libraryShareService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, formatId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// formatId can be null to clear the format
	if (formatId !== null && typeof formatId !== 'number') {
		throw error(400, 'formatId must be a number or null');
	}

	// A catalog field: each book needs the caller's catalog authority; the rest are skipped
	const user = locals.user;
	const { allowed, skipped } = await partitionBooks(bookIds, (book) => canEditBookCatalog(user, book));
	const now = new Date().toISOString();

	if (allowed.length > 0) {
		await db
			.update(books)
			.set({
				formatId,
				updatedAt: now
			})
			.where(inArray(books.id, allowed));
	}

	const note = skipped.length > 0 ? `; ${skipped.length} skipped (no permission or not found)` : '';
	return json({
		success: true,
		updated: allowed.length,
		skipped,
		message: (formatId
			? `Format set for ${allowed.length} book(s)`
			: `Format cleared from ${allowed.length} book(s)`) + note
	});
};
