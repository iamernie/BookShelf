import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBooks, createBook, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { notifyBookAdded } from '$lib/server/services/notificationService';

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

	// Pass userId for per-user library filtering
	const userId = locals.user?.id;
	const result = await getBooks({ page, limit, search, statusId, genreId, authorId, seriesId, sort, order, userId });
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

	const book = await createBook({
		title: data.title.trim(),
		summary: data.summary?.trim() || null,
		comments: data.comments?.trim() || null,
		rating: data.rating || null,
		coverImageUrl: data.coverImageUrl?.trim() || null,
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
		goodreadsId: data.goodreadsId?.trim() || null,
		googleBooksId: data.googleBooksId?.trim() || null,
		pageCount: data.pageCount || null,
		publisher: data.publisher?.trim() || null,
		publishYear: data.publishYear || null,
		language: data.language?.trim() || 'English',
		edition: data.edition?.trim() || null,
		purchasePrice: data.purchasePrice || null,
		authors: data.authors || [],
		series: data.series || [],
		tagIds: data.tagIds || [],
		ownerId: locals.user.id // Set the book owner to the current user
	});

	// Send notification for new book (fire and forget)
	notifyBookAdded(locals.user.id, {
		id: book.id,
		title: book.title,
		author: data.authors?.[0]?.name
	}).catch(err => console.error('[notifications] Failed to send book added notification:', err));

	return json(book, { status: 201 });
};
