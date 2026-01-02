import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, bookTags } from '$lib/server/db';
import { eq, and, inArray, sql } from 'drizzle-orm';

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

	const now = new Date().toISOString();
	let updated = 0;

	if (action === 'add') {
		// Add tags to books
		for (const bookId of bookIds) {
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
		for (const bookId of bookIds) {
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
		updated: bookIds.length, // Return number of books affected
		message: `Tags ${action === 'add' ? 'added to' : 'removed from'} ${bookIds.length} book(s)`
	});
};
