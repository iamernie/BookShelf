/**
 * Reading Progress API
 *
 * GET /api/ebooks/[id]/progress - Get reading progress
 * POST /api/ebooks/[id]/progress - Save reading progress
 *
 * Also syncs progress to KOReader when the user has sync enabled
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { parseReadingProgress, stringifyReadingProgress } from '$lib/server/services/ebookService';
import type { ReadingProgress } from '$lib/server/services/ebookService';
import { syncProgressFromBrowser } from '$lib/server/services/koreaderService';
import { syncFromWebReader as syncKoboProgress } from '$lib/server/services/koboReadingStateService';
import { canReadEbook } from '$lib/server/services/libraryShareService';

// Page values are optional: anything unusable is dropped, the save still goes through.
// 0 is a real value here, it's the first page of a comic.
function parsePageNumber(value: unknown): number | undefined {
	if (value === null || value === undefined) return undefined;
	const page = parseInt(String(value));
	return Number.isInteger(page) && page >= 0 ? page : undefined;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db
		.select({
			id: books.id,
			readingProgress: books.readingProgress,
			lastReadAt: books.lastReadAt
		})
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!(await canReadEbook(locals.user, bookId))) {
		throw error(403, { message: 'You do not have access to this book' });
	}

	const progress = parseReadingProgress(book.readingProgress);

	return json({
		success: true,
		progress,
		lastReadAt: book.lastReadAt
	});
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!(await canReadEbook(locals.user, bookId))) {
		throw error(403, { message: 'You do not have access to this book' });
	}

	const body = await request.json();
	const { location, percentage, chapter, currentPage, totalPages } = body;

	const progress: ReadingProgress = {
		location,
		percentage: parseFloat(percentage) || 0,
		chapter: chapter || undefined,
		currentPage: parsePageNumber(currentPage),
		totalPages: parsePageNumber(totalPages),
		savedAt: new Date().toISOString()
	};

	await db
		.update(books)
		.set({
			readingProgress: stringifyReadingProgress(progress),
			lastReadAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(eq(books.id, bookId));

	// Sync progress to KOReader and Kobo if user has sync enabled
	// This is best-effort - don't fail if sync fails
	let koreaderSynced = false;
	let koreaderSyncReason = '';
	let koboSynced = false;
	let koboSyncReason = '';

	if (locals.user?.id) {
		// Sync to KOReader
		try {
			const syncResult = await syncProgressFromBrowser(
				locals.user.id,
				bookId,
				progress.percentage,
				progress.currentPage
			);
			koreaderSynced = syncResult.synced;
			koreaderSyncReason = syncResult.reason;
			console.log(`[KOReader Sync] Book ${bookId}: synced=${koreaderSynced}, reason=${koreaderSyncReason}, percentage=${progress.percentage}%`);
		} catch (e) {
			console.error('[KOReader Sync] Failed to sync progress:', e);
			koreaderSyncReason = 'error';
		}

		// Sync to Kobo reading state
		try {
			const koboResult = await syncKoboProgress(
				locals.user.id,
				bookId,
				progress.percentage,
				location || ''
			);
			koboSynced = koboResult.synced;
			koboSyncReason = koboResult.reason;
			console.log(`[Kobo Sync] Book ${bookId}: synced=${koboSynced}, reason=${koboSyncReason}, percentage=${progress.percentage}%`);
		} catch (e) {
			console.error('[Kobo Sync] Failed to sync progress:', e);
			koboSyncReason = 'error';
		}
	}

	return json({
		success: true,
		progress,
		koreaderSynced,
		koreaderSyncReason,
		koboSynced,
		koboSyncReason
	});
};
