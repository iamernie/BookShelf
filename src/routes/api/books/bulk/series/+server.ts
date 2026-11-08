import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, bookSeries } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';
import { canEditBookCatalog, partitionBooks } from '$lib/server/services/libraryShareService';
import { recomputeSeriesStatuses } from '$lib/server/services/statusService';

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

	// A catalog field: each book needs the caller's catalog authority; the rest are skipped
	const user = locals.user;
	const { allowed, skipped } = await partitionBooks(bookIds, (book) => canEditBookCatalog(user, book));
	const note = skipped.length > 0 ? `; ${skipped.length} skipped (no permission or not found)` : '';

	const now = new Date().toISOString();
	let updated = 0;

	if (action === 'add') {
		// Add books to series
		for (const bookId of allowed) {
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
		await recomputeSeriesStatuses([seriesId]);

		return json({
			success: true,
			updated,
			skipped,
			message: `Added ${updated} book(s) to series${note}`
		});
	} else if (action === 'remove') {
		// Remove books from specific series
		for (const bookId of allowed) {
			const result = await db
				.delete(bookSeries)
				.where(and(eq(bookSeries.bookId, bookId), eq(bookSeries.seriesId, seriesId)));
			if (result.changes > 0) {
				updated++;
			}
		}

		await recomputeSeriesStatuses([seriesId]);

		return json({
			success: true,
			updated,
			skipped,
			message: `Removed ${updated} book(s) from series${note}`
		});
	} else {
		// Clear all series from books
		const cleared = allowed.length > 0
			? await db.select({ seriesId: bookSeries.seriesId }).from(bookSeries).where(inArray(bookSeries.bookId, allowed))
			: [];
		for (const bookId of allowed) {
			const result = await db
				.delete(bookSeries)
				.where(eq(bookSeries.bookId, bookId));
			if (result.changes > 0) {
				updated++;
			}
		}
		await recomputeSeriesStatuses(cleared.map((r) => r.seriesId));

		return json({
			success: true,
			updated,
			skipped,
			message: `Cleared series from ${updated} book(s)${note}`
		});
	}
};
