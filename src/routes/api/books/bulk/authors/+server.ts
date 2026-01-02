import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, bookAuthors } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, authorId, action, role } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (action !== 'add' && action !== 'remove' && action !== 'clear') {
		throw error(400, 'action must be "add", "remove", or "clear"');
	}

	if (action === 'add' || action === 'remove') {
		if (typeof authorId !== 'number') {
			throw error(400, 'authorId must be a number for add/remove actions');
		}
	}

	const now = new Date().toISOString();
	let updated = 0;

	if (action === 'add') {
		// Add author to books
		for (const bookId of bookIds) {
			// Check if already exists
			const existing = await db
				.select()
				.from(bookAuthors)
				.where(and(eq(bookAuthors.bookId, bookId), eq(bookAuthors.authorId, authorId)))
				.limit(1);

			if (!existing[0]) {
				// Check if this is the first author for this book
				const existingAuthors = await db
					.select()
					.from(bookAuthors)
					.where(eq(bookAuthors.bookId, bookId))
					.limit(1);

				await db.insert(bookAuthors).values({
					bookId,
					authorId,
					role: role || 'Author',
					isPrimary: existingAuthors.length === 0, // First author is primary
					displayOrder: existingAuthors.length,
					createdAt: now,
					updatedAt: now
				});
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Added author to ${updated} book(s)`
		});
	} else if (action === 'remove') {
		// Remove author from books
		for (const bookId of bookIds) {
			const result = await db
				.delete(bookAuthors)
				.where(and(eq(bookAuthors.bookId, bookId), eq(bookAuthors.authorId, authorId)));
			if (result.changes > 0) {
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Removed author from ${updated} book(s)`
		});
	} else {
		// Clear all authors from books
		for (const bookId of bookIds) {
			const result = await db
				.delete(bookAuthors)
				.where(eq(bookAuthors.bookId, bookId));
			if (result.changes > 0) {
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Cleared authors from ${updated} book(s)`
		});
	}
};
