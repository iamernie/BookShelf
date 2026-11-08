import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBookById, updateBook, deleteBook, AbsItemAlreadyLinkedError } from '$lib/server/services/bookService';
import { removeBookFromUserLibrary, getUserBook } from '$lib/server/services/userBookService';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';
import { canReachBook, canViewBook, canEditBookCatalog, canDeleteBook, hideOwnerFrom } from '$lib/server/services/libraryShareService';
import { applyStatusChange } from '$lib/server/services/statusService';
import { downloadCoverImage } from '$lib/server/services/coverService';
import { applyAbsTagParity } from '$lib/server/services/absService';
import { overlayPersonal, writePersonal, hasPersonal, type PersonalWrite } from '$lib/server/services/personalState';
import { db, books } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// One ABS item, one book; the other book's title is only shown to users who can see that book
async function absLinkConflict(err: AbsItemAlreadyLinkedError, userId: number): Promise<Response> {
	if (await canReachBook(userId, err.bookId)) {
		return json({ message: err.message, details: { bookId: err.bookId } }, { status: 409 });
	}
	return json({ message: 'Audiobookshelf item is already linked to another book' }, { status: 409 });
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid book ID' });
	}

	const book = await getBookById(id, locals.user?.id ?? null);
	if (!book) {
		throw error(404, { message: 'Book not found' });
	}

	// Check if user can see this book (admins and librarians see every book; writes stay on canReachBook)
	if (locals.user) {
		const hasAccess = await canViewBook(locals.user, id);
		if (!hasAccess) {
			throw error(403, { message: 'You do not have access to this book' });
		}
	}

	return json(hideOwnerFrom(locals.user, book));
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
			ownerId: books.ownerId
		})
		.from(books)
		.where(eq(books.id, id))
		.limit(1);

	if (!existingBook) {
		throw error(404, { message: 'Book not found' });
	}

	// Personal fields (rating, notes, status, reading dates, DNF) are the caller's own and only need
	// the book to be reachable; the catalog permission gate below applies to catalog fields only
	if (!(await canReachBook(locals.user.id, id))) {
		throw error(403, { message: 'You do not have access to this book' });
	}

	const data = await request.json();

	const personal: PersonalWrite = {};
	if (data.rating !== undefined) personal.rating = data.rating || null;
	if (data.comments !== undefined) personal.comments = data.comments?.trim() || null;
	if (data.startReadingDate !== undefined) personal.startReadingDate = data.startReadingDate || null;
	if (data.completedDate !== undefined) personal.completedDate = data.completedDate || null;
	if (data.dnfPage !== undefined) personal.dnfPage = data.dnfPage ?? null;
	if (data.dnfPercent !== undefined) personal.dnfPercent = data.dnfPercent ?? null;
	if (data.dnfReason !== undefined) personal.dnfReason = data.dnfReason?.trim() || null;
	if (data.dnfDate !== undefined) personal.dnfDate = data.dnfDate || null;
	const statusId: number | null | undefined = data.statusId !== undefined ? data.statusId || null : undefined;

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

	// Handle cover image - auto-download if originalCoverUrl provided but no coverImageUrl
	let coverImageUrl = data.coverImageUrl?.trim() || null;
	const originalCoverUrl = data.originalCoverUrl?.trim() || null;

	if (originalCoverUrl && !coverImageUrl) {
		// Auto-download cover image
		const downloadedPath = await downloadCoverImage(originalCoverUrl, id);
		if (downloadedPath) {
			coverImageUrl = downloadedPath;
		}
	}

	if (data.coverImageUrl !== undefined || coverImageUrl) updateData.coverImageUrl = coverImageUrl;
	if (data.originalCoverUrl !== undefined) updateData.originalCoverUrl = originalCoverUrl;
	if (data.isbn10 !== undefined) updateData.isbn10 = data.isbn10?.trim() || null;
	if (data.isbn13 !== undefined) updateData.isbn13 = data.isbn13?.trim() || null;
	if (data.asin !== undefined) updateData.asin = data.asin?.trim() || null;
	if (data.absItemId !== undefined) updateData.absItemId = data.absItemId?.trim() || null;
	if (data.goodreadsId !== undefined) updateData.goodreadsId = data.goodreadsId?.trim() || null;
	if (data.googleBooksId !== undefined) updateData.googleBooksId = data.googleBooksId?.trim() || null;
	if (data.publisher !== undefined) updateData.publisher = data.publisher?.trim() || null;
	if (data.language !== undefined) updateData.language = data.language?.trim() || 'English';
	if (data.edition !== undefined) updateData.edition = data.edition?.trim() || null;

	// Number fields
	if (data.pageCount !== undefined) updateData.pageCount = data.pageCount || null;
	if (data.publishYear !== undefined) updateData.publishYear = data.publishYear || null;

	// Provider (external) rating fields - separate from the user's personal rating
	if (data.providerRating !== undefined) updateData.providerRating = data.providerRating ?? null;
	if (data.providerRatingSource !== undefined) updateData.providerRatingSource = data.providerRatingSource?.trim() || null;
	if (data.providerRatingCount !== undefined) updateData.providerRatingCount = data.providerRatingCount ?? null;

	// Foreign key fields (statusId goes through applyStatusChange below)
	if (data.genreId !== undefined) updateData.genreId = data.genreId || null;
	if (data.formatId !== undefined) updateData.formatId = data.formatId || null;
	if (data.narratorId !== undefined) updateData.narratorId = data.narratorId || null;

	// Date fields
	if (data.releaseDate !== undefined) updateData.releaseDate = data.releaseDate || null;

	// Relation arrays (only include if explicitly provided)
	if (data.authors !== undefined) updateData.authors = data.authors;
	if (data.series !== undefined) updateData.series = data.series;
	if (data.tagIds !== undefined) updateData.tagIds = data.tagIds;

	const catalogChange = Object.keys(updateData).length > 0;
	// Require at least one field to update
	if (!catalogChange && statusId === undefined && !hasPersonal(personal)) {
		throw error(400, { message: 'No fields to update' });
	}

	// Catalog permission depends on library type
	if (catalogChange) {
		// Public library books: admins and librarians; personal ones: ownership or a write share
		if (!(await canEditBookCatalog(locals.user, { id, libraryType: existingBook.libraryType }))) {
			throw error(403, {
				message: existingBook.libraryType === 'public'
					? 'Only librarians and admins can edit public library books'
					: 'You do not have permission to modify this book'
			});
		}
		try {
			const updated = await updateBook(id, updateData);
			if (!updated) throw error(404, { message: 'Book not found' });
		} catch (err) {
			if (err instanceof AbsItemAlreadyLinkedError) return absLinkConflict(err, locals.user.id);
			throw err;
		}
	}

	// The caller's own reading record, dates first: a status change then stamps only empty ones
	if (hasPersonal(personal)) await writePersonal(locals.user.id, id, personal);
	if (statusId !== undefined) {
		// A date sent with the edit wins over stamping; an empty one leaves stamping on
		const dates: { startReadingDate?: string; completedDate?: string } = {};
		if (personal.startReadingDate) dates.startReadingDate = personal.startReadingDate;
		if (personal.completedDate) dates.completedDate = personal.completedDate;
		await applyStatusChange([id], statusId, { source: 'book_edit', userId: locals.user.id, dates });
	}

	// Keep the "Audiobook Shelf" tag in step with manual link/unlink
	if (data.absItemId !== undefined) await applyAbsTagParity(id);

	const [row] = await db.select().from(books).where(eq(books.id, id)).limit(1);
	if (!row) throw error(404, { message: 'Book not found' });
	const [book] = await overlayPersonal([row], locals.user.id);
	return json(hideOwnerFrom(locals.user, book));
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
