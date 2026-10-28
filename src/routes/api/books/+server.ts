import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBooks, createBook, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries, AbsItemAlreadyLinkedError } from '$lib/server/services/bookService';
import { canAccessBook } from '$lib/server/services/libraryShareService';
import { notifyBookAdded } from '$lib/server/services/notificationService';
import { downloadCoverImage } from '$lib/server/services/coverService';
import { getAuthorById } from '$lib/server/services/authorService';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');
	const search = url.searchParams.get('search') || url.searchParams.get('q') || undefined;
	const statusId = url.searchParams.get('status') ? parseInt(url.searchParams.get('status')!) : undefined;
	const genreId = url.searchParams.get('genre') ? parseInt(url.searchParams.get('genre')!) : undefined;
	const authorId = url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined;
	const seriesId = url.searchParams.get('series') ? parseInt(url.searchParams.get('series')!) : undefined;
	const sort = (url.searchParams.get('sort') as 'title' | 'createdAt' | 'rating' | 'completedDate') || 'createdAt';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'desc';
	// absLinked=false returns only books not yet linked to an Audiobookshelf item
	const absLinked = url.searchParams.get('absLinked') === 'false' ? false : undefined;

	// Pass userId for per-user library filtering
	const userId = locals.user?.id;
	const result = await getBooks({ page, limit, search, statusId, genreId, authorId, seriesId, sort, order, userId, absLinked });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.title?.trim()) {
		throw error(400, { message: 'Title is required' });
	}

	// Adds default to the personal library; public library adds are librarian/admin only
	const isPublic = data.libraryType === 'public';
	if (isPublic && !canManagePublicLibrary(locals.user)) {
		throw error(403, { message: 'Only librarians and admins can add public library books' });
	}

	// If there's an originalCoverUrl but no coverImageUrl, try to download the cover
	let coverImageUrl = data.coverImageUrl?.trim() || null;
	const originalCoverUrl = data.originalCoverUrl?.trim() || null;

	if (originalCoverUrl && !coverImageUrl) {
		// Auto-download cover image in the background
		const downloadedPath = await downloadCoverImage(originalCoverUrl);
		if (downloadedPath) {
			coverImageUrl = downloadedPath;
		}
	}

	let book;
	try {
		book = await createBook({
			title: data.title.trim(),
			summary: data.summary?.trim() || null,
			comments: data.comments?.trim() || null,
			rating: data.rating || null,
			providerRating: data.providerRating ?? null,
			providerRatingSource: data.providerRatingSource?.trim() || null,
			providerRatingCount: data.providerRatingCount ?? null,
			coverImageUrl,
			originalCoverUrl,
			statusId: data.statusId || null,
			genreId: data.genreId || null,
			formatId: data.formatId || null,
			narratorId: data.narratorId || null,
			releaseDate: data.releaseDate || null,
			startReadingDate: data.startReadingDate || null,
			completedDate: data.completedDate || null,
			isbn10: data.isbn10?.trim() || null,
			isbn13: data.isbn13?.trim() || null,
			asin: data.asin?.trim() || null,
			absItemId: data.absItemId?.trim() || null,
			goodreadsId: data.goodreadsId?.trim() || null,
			googleBooksId: data.googleBooksId?.trim() || null,
			pageCount: data.pageCount || null,
			booksContained: data.booksContained || 1,
			publisher: data.publisher?.trim() || null,
			publishYear: data.publishYear || null,
			language: data.language?.trim() || 'English',
			edition: data.edition?.trim() || null,
			purchasePrice: data.purchasePrice || null,
			authors: data.authors || [],
			series: data.series || [],
			tagIds: data.tagIds || [],
			libraryType: isPublic ? 'public' : 'personal',
			// Personal books are owned by the current user; public library books have no owner
			ownerId: isPublic ? undefined : locals.user.id
		});
	} catch (err) {
		// One ABS item, one book; the other book's title is only shown to users who can see it
		if (err instanceof AbsItemAlreadyLinkedError) {
			return (await canAccessBook(locals.user.id, err.bookId))
				? json({ message: err.message, details: { bookId: err.bookId } }, { status: 409 })
				: json({ message: 'Audiobookshelf item is already linked to another book' }, { status: 409 });
		}
		throw err;
	}

	// Editors send authors as { id, role }, so resolve the primary author's name for the notification
	const authorList: { id: number; isPrimary?: boolean }[] = Array.isArray(data.authors) ? data.authors : [];
	const primaryAuthorId = (authorList.find((a) => a.isPrimary) ?? authorList[0])?.id;
	const primaryAuthor = primaryAuthorId ? await getAuthorById(primaryAuthorId) : null;

	// Send notification for new book (fire and forget)
	notifyBookAdded(locals.user.id, {
		id: book.id,
		title: book.title,
		author: primaryAuthor?.name
	}).catch(err => console.error('[notifications] Failed to send book added notification:', err));

	return json(book, { status: 201 });
};
