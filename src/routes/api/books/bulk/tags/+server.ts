import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, bookTags } from '$lib/server/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { canEditBookCatalog, partitionBooks } from '$lib/server/services/libraryShareService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, tagIds, action } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (!Array.isArray(tagIds) || tagIds.length === 0) {
		throw error(400, 'tagIds must be a non-empty array');
	}

	if (action !== 'add' && action !== 'remove') {
		throw error(400, 'action must be "add" or "remove"');
	}

	// A catalog field: each book needs the caller's catalog authority; the rest are skipped
	const user = locals.user;
	const { allowed, skipped } = await partitionBooks(bookIds, (book) => canEditBookCatalog(user, book));
	const note = skipped.length > 0 ? `; ${skipped.length} skipped (no permission or not found)` : '';

	const now = new Date().toISOString();
	let updated = 0;

	if (action === 'add') {
		// Add tags to books
		for (const bookId of allowed) {
			for (const tagId of tagIds) {
				// Check if already exists
				const existing = await db
					.select()
					.from(bookTags)
					.where(and(eq(bookTags.bookId, bookId), eq(bookTags.tagId, tagId)))
					.limit(1);

				if (!existing[0]) {
					await db.insert(bookTags).values({
						bookId,
						tagId,
						createdAt: now,
						updatedAt: now
					});
					updated++;
				}
			}
		}
	} else {
		// Remove tags from books
		for (const bookId of allowed) {
			for (const tagId of tagIds) {
				const result = await db
					.delete(bookTags)
					.where(and(eq(bookTags.bookId, bookId), eq(bookTags.tagId, tagId)));
				if (result.changes > 0) {
					updated++;
				}
			}
		}
	}

	return json({
		success: true,
		updated: allowed.length, // Return number of books affected
		skipped,
		message: `Tags ${action === 'add' ? 'added to' : 'removed from'} ${allowed.length} book(s)${note}`
	});
};
