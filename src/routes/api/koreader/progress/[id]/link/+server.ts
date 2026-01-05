/**
 * KOReader Progress Link API
 *
 * POST /api/koreader/progress/[id]/link - Link a progress entry to a book
 * DELETE /api/koreader/progress/[id]/link - Unlink a progress entry from a book
 *
 * This allows manual linking when MD5 hashes don't match (e.g., different EPUB versions)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { koreaderProgress, books } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const progressId = parseInt(params.id);
	if (isNaN(progressId)) {
		throw error(400, 'Invalid progress ID');
	}

	let data: { bookId: number };
	try {
		data = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!data.bookId || typeof data.bookId !== 'number') {
		throw error(400, 'bookId is required');
	}

	// Verify the progress entry exists and belongs to this user
	const [progress] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.id, progressId),
				eq(koreaderProgress.userId, locals.user.id)
			)
		)
		.limit(1);

	if (!progress) {
		throw error(404, 'Progress entry not found');
	}

	// Verify the book exists
	const [book] = await db
		.select({ id: books.id, title: books.title })
		.from(books)
		.where(eq(books.id, data.bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Update the progress entry to link to the book
	await db
		.update(koreaderProgress)
		.set({
			bookId: data.bookId,
			updatedAt: new Date().toISOString()
		})
		.where(eq(koreaderProgress.id, progressId));

	// Also update the book's ebookMd5 to match this document hash
	// This enables future automatic syncing
	await db
		.update(books)
		.set({
			ebookMd5: progress.documentHash,
			updatedAt: new Date().toISOString()
		})
		.where(eq(books.id, data.bookId));

	return json({
		success: true,
		message: `Linked to "${book.title}"`,
		bookId: book.id,
		bookTitle: book.title
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const progressId = parseInt(params.id);
	if (isNaN(progressId)) {
		throw error(400, 'Invalid progress ID');
	}

	// Verify the progress entry exists and belongs to this user
	const [progress] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.id, progressId),
				eq(koreaderProgress.userId, locals.user.id)
			)
		)
		.limit(1);

	if (!progress) {
		throw error(404, 'Progress entry not found');
	}

	// Remove the link
	await db
		.update(koreaderProgress)
		.set({
			bookId: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(koreaderProgress.id, progressId));

	return json({ success: true });
};
