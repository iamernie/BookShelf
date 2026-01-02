import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBookById, updateBook, deleteBook } from '$lib/server/services/bookService';
import { removeBookFromUserLibrary, getUserBook } from '$lib/server/services/userBookService';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';
import { canAccessBook, canModifyBook, canDeleteBook } from '$lib/server/services/libraryShareService';
import { getStatusByKey } from '$lib/server/services/statusService';
import { db, books } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { notifyBookCompleted, checkAndNotifySeriesCompletion } from '$lib/server/services/notificationService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid book ID' });
	}

	const book = await getBookById(id);
	if (!book) {
		throw error(404, { message: 'Book not found' });
	}

	// Check if user has access to this book
	if (locals.user) {
		const hasAccess = await canAccessBook(locals.user.id, id);
		if (!hasAccess) {
			throw error(403, { message: 'You do not have access to this book' });
		}
	}

	return json(book);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid book ID' });
	}

	// Check the book's library type to determine permission model
	const [existingBook] = await db
		.select({
			id: books.id,
			libraryType: books.libraryType,
			ownerId: books.ownerId,
			statusId: books.statusId,
			startReadingDate: books.startReadingDate,
			completedDate: books.completedDate
		})
		.from(books)
		.where(eq(books.id, id))
		.limit(1);

	if (!existingBook) {
		throw error(404, { message: 'Book not found' });
	}

	// Permission check depends on library type
	if (existingBook.libraryType === 'public') {
		// Public library books: only admins and librarians can edit
		if (!canManagePublicLibrary(locals.user)) {
			throw error(403, { message: 'Only librarians and admins can edit public library books' });
		}
	} else {
		// Personal library books: check ownership/sharing permissions
		const canModify = await canModifyBook(locals.user.id, id);
		if (!canModify) {
			throw error(403, { message: 'You do not have permission to modify this book' });
		}
	}

	const data = await request.json();

	// Build update object with only provided fields (for partial updates)
	const updateData: Record<string, unknown> = {};

	// Title is required only for full updates, not partial updates
	if (data.title !== undefined) {
		if (!data.title?.trim()) {
			throw error(400, { message: 'Title cannot be empty' });
		}
		updateData.title = data.title.trim();
	}

	// Text fields
	if (data.summary !== undefined) updateData.summary = data.summary?.trim() || null;
	if (data.comments !== undefined) updateData.comments = data.comments?.trim() || null;
	if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl?.trim() || null;
	if (data.originalCoverUrl !== undefined) updateData.originalCoverUrl = data.originalCoverUrl?.trim() || null;
	if (data.isbn10 !== undefined) updateData.isbn10 = data.isbn10?.trim() || null;
	if (data.isbn13 !== undefined) updateData.isbn13 = data.isbn13?.trim() || null;
	if (data.asin !== undefined) updateData.asin = data.asin?.trim() || null;
	if (data.goodreadsId !== undefined) updateData.goodreadsId = data.goodreadsId?.trim() || null;
	if (data.googleBooksId !== undefined) updateData.googleBooksId = data.googleBooksId?.trim() || null;
	if (data.publisher !== undefined) updateData.publisher = data.publisher?.trim() || null;
	if (data.language !== undefined) updateData.language = data.language?.trim() || 'English';
	if (data.edition !== undefined) updateData.edition = data.edition?.trim() || null;

	// Number fields
	if (data.rating !== undefined) updateData.rating = data.rating || null;
	if (data.pageCount !== undefined) updateData.pageCount = data.pageCount || null;
	if (data.publishYear !== undefined) updateData.publishYear = data.publishYear || null;
	if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice || null;

	// Foreign key fields
	if (data.statusId !== undefined) updateData.statusId = data.statusId || null;
	if (data.genreId !== undefined) updateData.genreId = data.genreId || null;
	if (data.formatId !== undefined) updateData.formatId = data.formatId || null;
	if (data.narratorId !== undefined) updateData.narratorId = data.narratorId || null;

	// Date fields
	if (data.releaseDate !== undefined) updateData.releaseDate = data.releaseDate || null;
	if (data.startReadingDate !== undefined) updateData.startReadingDate = data.startReadingDate || null;
	if (data.completedDate !== undefined) updateData.completedDate = data.completedDate || null;

	// Track if this is a book completion (for notification)
	let isBookCompletion = false;

	// Auto-set dates when status changes (only if date not already set and not explicitly provided)
	if (data.statusId !== undefined && data.statusId !== existingBook.statusId) {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

		// Get the status keys for CURRENT and READ
		const [currentStatus, readStatus] = await Promise.all([
			getStatusByKey('CURRENT'),
			getStatusByKey('READ')
		]);

		// If changing to CURRENT and no startReadingDate is set
		if (currentStatus && data.statusId === currentStatus.id) {
			const existingStartDate = data.startReadingDate !== undefined
				? data.startReadingDate
				: existingBook.startReadingDate;
			if (!existingStartDate) {
				updateData.startReadingDate = today;
			}
		}

		// If changing to READ and no completedDate is set
		if (readStatus && data.statusId === readStatus.id) {
			const existingCompletedDate = data.completedDate !== undefined
				? data.completedDate
				: existingBook.completedDate;
			if (!existingCompletedDate) {
				updateData.completedDate = today;
			}
			// Mark this as a completion for notification
			isBookCompletion = true;
		}
	}

	// Relation arrays (only include if explicitly provided)
	if (data.authors !== undefined) updateData.authors = data.authors;
	if (data.series !== undefined) updateData.series = data.series;
	if (data.tagIds !== undefined) updateData.tagIds = data.tagIds;

	// Require at least one field to update
	if (Object.keys(updateData).length === 0) {
		throw error(400, { message: 'No fields to update' });
	}

	const book = await updateBook(id, updateData);

	if (!book) {
		throw error(404, { message: 'Book not found' });
	}

	// Send book completed notification if applicable (fire and forget)
	if (isBookCompletion && locals.user) {
		notifyBookCompleted(locals.user.id, {
			id: book.id,
			title: book.title
		}).catch(err => console.error('[notifications] Failed to send book completed notification:', err));

		// Check if this completes any series
		checkAndNotifySeriesCompletion(locals.user.id, book.id)
			.catch(err => console.error('[notifications] Failed to check series completion:', err));
	}

	return json(book);
};

export const DELETE: RequestHandler = async ({ params, request, url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid book ID' });
	}

	// Check if admin wants to permanently delete (via query param)
	const permanentDelete = url.searchParams.get('permanent') === 'true';

	// Check the book's library type
	const [book] = await db
		.select({ id: books.id, libraryType: books.libraryType })
		.from(books)
		.where(eq(books.id, id))
		.limit(1);

	if (!book) {
		throw error(404, { message: 'Book not found' });
	}

	// If it's a public library book
	if (book.libraryType === 'public') {
		// Admin can permanently delete public library books
		if (permanentDelete) {
			if (!canManagePublicLibrary(locals.user)) {
				throw error(403, {
					message: 'Only admins can permanently delete books from the public library.'
				});
			}

			const deleted = await deleteBook(id);
			if (!deleted) {
				throw error(404, { message: 'Book not found' });
			}

			return json({
				success: true,
				action: 'deleted',
				message: 'Book permanently deleted from the public library.'
			});
		}

		// Regular users can only remove from their personal library
		const userBook = await getUserBook(locals.user.id, id);
		if (!userBook) {
			throw error(400, {
				message: 'This is a public library book. You can only remove it from your personal library if you have added it.'
			});
		}

		await removeBookFromUserLibrary(locals.user.id, id);
		return json({
			success: true,
			action: 'removed_from_library',
			message: 'Book removed from your personal library. It remains in the public library.'
		});
	}

	// For personal library books, check delete permission
	const canDelete = await canDeleteBook(locals.user.id, id);
	if (!canDelete) {
		throw error(403, { message: 'You do not have permission to delete this book' });
	}

	const deleted = await deleteBook(id);
	if (!deleted) {
		throw error(404, { message: 'Book not found' });
	}

	return json({ success: true, action: 'deleted' });
};
