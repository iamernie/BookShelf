/**
 * Reading Progress API
 *
 * GET /api/ebooks/[id]/progress - Get reading progress
 * POST /api/ebooks/[id]/progress - Save reading progress
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { parseReadingProgress, stringifyReadingProgress } from '$lib/server/services/ebookService';
import type { ReadingProgress } from '$lib/server/services/ebookService';

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

export const POST: RequestHandler = async ({ params, request }) => {
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

	return json({
		success: true,
		progress
	});
};
