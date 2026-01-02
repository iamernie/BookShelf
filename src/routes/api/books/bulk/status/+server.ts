import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { eq, inArray, and, isNull } from 'drizzle-orm';
import { getStatusByKey } from '$lib/server/services/statusService';
import { notifyBookCompleted, checkAndNotifySeriesCompletion } from '$lib/server/services/notificationService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, statusId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (typeof statusId !== 'number') {
		throw error(400, 'statusId must be a number');
	}

	const now = new Date().toISOString();
	const today = now.split('T')[0]; // YYYY-MM-DD format

	// Get status keys
	const [currentStatus, readStatus] = await Promise.all([
		getStatusByKey('CURRENT'),
		getStatusByKey('READ')
	]);

	// Update all books in one query
	await db
		.update(books)
		.set({
			statusId,
			updatedAt: now
		})
		.where(inArray(books.id, bookIds));

	// Auto-set startReadingDate for CURRENT status (only for books without a date)
	if (currentStatus && statusId === currentStatus.id) {
		await db
			.update(books)
			.set({ startReadingDate: today, updatedAt: now })
			.where(and(
				inArray(books.id, bookIds),
				isNull(books.startReadingDate)
			));
	}

	// Auto-set completedDate for READ status (only for books without a date)
	if (readStatus && statusId === readStatus.id) {
		await db
			.update(books)
			.set({ completedDate: today, updatedAt: now })
			.where(and(
				inArray(books.id, bookIds),
				isNull(books.completedDate)
			));

		// Send book completed notifications (fire and forget)
		// Fetch book titles for notifications
		const completedBooks = await db
			.select({ id: books.id, title: books.title })
			.from(books)
			.where(inArray(books.id, bookIds));

		for (const book of completedBooks) {
			notifyBookCompleted(locals.user.id, { id: book.id, title: book.title })
				.catch(err => console.error('[notifications] Failed to send book completed notification:', err));

			// Check if this completes any series
			checkAndNotifySeriesCompletion(locals.user.id, book.id)
				.catch(err => console.error('[notifications] Failed to check series completion:', err));
		}
	}

	return json({
		success: true,
		updated: bookIds.length,
		message: `Status updated for ${bookIds.length} book(s)`
	});
};
