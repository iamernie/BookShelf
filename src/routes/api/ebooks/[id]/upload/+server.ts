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
import { canManagePublicLibrary, hasPermission, Permission } from '$lib/server/services/permissionService';
import { canModifyBook } from '$lib/server/services/libraryShareService';
import { saveEbook, deleteEbook } from '$lib/server/services/ebookService';
import { setCurrentEbookHash } from '$lib/server/services/ebookHashService';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!hasPermission(locals.user, Permission.UPLOAD_EBOOKS)) {
		throw error(403, { message: 'You do not have permission to upload ebooks' });
	}

	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Get the book
	const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Same permission model as PUT /api/books/[id]
	if (book.libraryType === 'public') {
		if (!canManagePublicLibrary(locals.user)) {
			throw error(403, { message: 'Only librarians and admins can edit public library books' });
		}
	} else if (!(await canModifyBook(locals.user.id, bookId))) {
		throw error(403, { message: 'You do not have permission to modify this book' });
	}

	// Parse multipart form data
	const formData = await request.formData();
	const file = formData.get('ebook') as File | null;

	if (!file) {
		throw error(400, 'No file uploaded');
	}

	// Save new ebook first: a failed save must leave the old file and record untouched
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

	// Update book record with ebook path and format
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

	// The old hash stays known, so a device still holding the old file keeps its link
	if (result.md5) {
		await setCurrentEbookHash(bookId, result.md5, 'upload');
	}

	// Old file goes last, once nothing points at it. A failed delete only leaves an orphan.
	if (book.ebookPath && book.ebookPath !== result.filename) {
		await deleteEbook(book.ebookPath);
	}

	return json({
		success: true,
		message: 'Ebook uploaded successfully',
		ebookPath: result.filename,
		ebookFormat: result.format,
		formatId: ebookFormat?.id
	});
};
