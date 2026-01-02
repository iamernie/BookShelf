/**
 * Ebook Upload API
 *
 * POST /api/ebooks/[id]/upload - Upload an ebook for a book
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books, formats } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { saveEbook, deleteEbook } from '$lib/server/services/ebookService';

export const POST: RequestHandler = async ({ params, request }) => {
	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Get the book
	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Parse multipart form data
	const formData = await request.formData();
	const file = formData.get('ebook') as File | null;

	if (!file) {
		throw error(400, 'No file uploaded');
	}

	// Delete old ebook if exists
	if (book.ebookPath) {
		await deleteEbook(book.ebookPath);
	}

	// Save new ebook
	const result = await saveEbook(file, bookId);

	if (!result.success) {
		throw error(400, result.error || 'Failed to upload ebook');
	}

	// Find the eBook format ID
	const [ebookFormat] = await db
		.select({ id: formats.id })
		.from(formats)
		.where(eq(formats.name, 'eBook'))
		.limit(1);

	// Update book record with ebook path and automatically set format to eBook
	const updateData: Record<string, unknown> = {
		ebookPath: result.filename,
		ebookFormat: result.format,
		updatedAt: new Date().toISOString()
	};

	// Only set formatId if eBook format exists and book doesn't already have a format
	if (ebookFormat && !book.formatId) {
		updateData.formatId = ebookFormat.id;
	}

	await db
		.update(books)
		.set(updateData)
		.where(eq(books.id, bookId));

	return json({
		success: true,
		message: 'Ebook uploaded successfully',
		ebookPath: result.filename,
		ebookFormat: result.format,
		formatId: ebookFormat?.id
	});
};
