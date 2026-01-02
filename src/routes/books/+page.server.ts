import type { PageServerLoad } from './$types';
import { getBooks, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const search = url.searchParams.get('search') || undefined;
	const statusId = url.searchParams.get('status') ? parseInt(url.searchParams.get('status')!) : undefined;
	const genreId = url.searchParams.get('genre') ? parseInt(url.searchParams.get('genre')!) : undefined;
	const formatId = url.searchParams.get('format') ? parseInt(url.searchParams.get('format')!) : undefined;
	const tagId = url.searchParams.get('tag') ? parseInt(url.searchParams.get('tag')!) : undefined;
	const authorId = url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined;
	const seriesId = url.searchParams.get('series') ? parseInt(url.searchParams.get('series')!) : undefined;
	const sort = (url.searchParams.get('sort') as 'title' | 'createdAt' | 'rating' | 'completedDate' | 'series' | 'status' | 'format' | 'genre') || 'createdAt';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'desc';
	const filterMode = (url.searchParams.get('filterMode') as 'and' | 'or') || 'and';

	// Pass userId to include books from public library that user has added to their library
	const userId = locals.user?.id;

	const [booksResult, statuses, genres, formats, narrators, tags, authors, series] = await Promise.all([
		getBooks({ page, limit: 24, search, statusId, genreId, formatId, tagId, authorId, seriesId, sort, order, userId, filterMode }),
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries()
	]);

	return {
		...booksResult,
		search: search || '',
		sort,
		order,
		filterMode,
		statusId,
		genreId,
		formatId,
		tagId,
		authorId,
		seriesId,
		options: {
			statuses,
			genres,
			formats,
			narrators,
			tags,
			authors,
			series
		}
	};
};
