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

export const GET: RequestHandler = async ({ params }) => {
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

	const progress = parseReadingProgress(book.readingProgress);

	return json({
		success: true,
		progress,
		lastReadAt: book.lastReadAt
	});
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	const body = await request.json();
	const { location, percentage, chapter, currentPage, totalPages } = body;

	const progress: ReadingProgress = {
		location,
		percentage: parseFloat(percentage) || 0,
		chapter: chapter || undefined,
		currentPage: currentPage ? parseInt(currentPage) : undefined,
		totalPages: totalPages ? parseInt(totalPages) : undefined,
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

	// Sync progress to KOReader if user has sync enabled
	// This is best-effort - don't fail if sync fails
	let koreaderSynced = false;
	let koreaderSyncReason = '';
	if (locals.user?.id) {
		try {
			const syncResult = await syncProgressFromBrowser(
				locals.user.id,
				bookId,
				progress.percentage,
				location || ''
			);
			koreaderSynced = syncResult.synced;
			koreaderSyncReason = syncResult.reason;
			console.log(`[KOReader Sync] Book ${bookId}: synced=${koreaderSynced}, reason=${koreaderSyncReason}, percentage=${progress.percentage}%`);
		} catch (e) {
			console.error('[KOReader Sync] Failed to sync progress:', e);
			koreaderSyncReason = 'error';
		}
	}

	return json({
		success: true,
		progress,
		koreaderSynced,
		koreaderSyncReason
	});
};
