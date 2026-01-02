import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, bookSeries } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, seriesId, action, bookNum } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (action !== 'add' && action !== 'remove' && action !== 'clear') {
		throw error(400, 'action must be "add", "remove", or "clear"');
	}

	if (action === 'add' || action === 'remove') {
		if (typeof seriesId !== 'number') {
			throw error(400, 'seriesId must be a number for add/remove actions');
		}
	}

	const now = new Date().toISOString();
	let updated = 0;

	if (action === 'add') {
		// Add books to series
		for (const bookId of bookIds) {
			// Check if already exists
			const existing = await db
				.select()
				.from(bookSeries)
				.where(and(eq(bookSeries.bookId, bookId), eq(bookSeries.seriesId, seriesId)))
				.limit(1);

			if (!existing[0]) {
				// Check if this is the first series for this book
				const existingSeries = await db
					.select()
					.from(bookSeries)
					.where(eq(bookSeries.bookId, bookId))
					.limit(1);

				await db.insert(bookSeries).values({
					bookId,
					seriesId,
					bookNum: bookNum || null,
					isPrimary: existingSeries.length === 0, // First series is primary
					displayOrder: existingSeries.length,
					createdAt: now,
					updatedAt: now
				});
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Added ${updated} book(s) to series`
		});
	} else if (action === 'remove') {
		// Remove books from specific series
		for (const bookId of bookIds) {
			const result = await db
				.delete(bookSeries)
				.where(and(eq(bookSeries.bookId, bookId), eq(bookSeries.seriesId, seriesId)));
			if (result.changes > 0) {
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Removed ${updated} book(s) from series`
		});
	} else {
		// Clear all series from books
		for (const bookId of bookIds) {
			const result = await db
				.delete(bookSeries)
				.where(eq(bookSeries.bookId, bookId));
			if (result.changes > 0) {
				updated++;
			}
		}

		return json({
			success: true,
			updated,
			message: `Cleared series from ${updated} book(s)`
		});
	}
};
