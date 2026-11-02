import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getBooks, type BookSort, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';
import { browseCookieName, pastEndRedirect, resolveBrowse } from '$lib/utils/browse';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	// URL params win; the saved browse cookie fills in sort, order, limit and the view
	const { view, sort, order, limit, page } = resolveBrowse('books', url.searchParams, cookies.get(browseCookieName('books')));
	const search = url.searchParams.get('search') || undefined;
	const statusId = url.searchParams.get('status') ? parseInt(url.searchParams.get('status')!) : undefined;
	const genreId = url.searchParams.get('genre') ? parseInt(url.searchParams.get('genre')!) : undefined;
	const formatId = url.searchParams.get('format') ? parseInt(url.searchParams.get('format')!) : undefined;
	const tagId = url.searchParams.get('tag') ? parseInt(url.searchParams.get('tag')!) : undefined;
	const authorId = url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined;
	const seriesId = url.searchParams.get('series') ? parseInt(url.searchParams.get('series')!) : undefined;
	const filterMode = (url.searchParams.get('filterMode') as 'and' | 'or') || 'and';

	// Pass userId to include books from public library that user has added to their library
	const userId = locals.user?.id;

	const [booksResult, statuses, genres, formats, narrators, tags, authors, series, absBaseUrl] = await Promise.all([
		getBooks({ page, limit, search, statusId, genreId, formatId, tagId, authorId, seriesId, sort: sort as BookSort, order, userId, filterMode }),
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries(),
		getAbsLinkBaseUrl()
	]);

	// A stale page (e.g. Back after a bigger page size) lands on the last real page instead of an empty one
	const pastEnd = pastEndRedirect(url, { page, limit, total: booksResult.total, count: booksResult.items.length });
	if (pastEnd) redirect(302, pastEnd);

	return {
		...booksResult,
		search: search || '',
		view,
		sort,
		order,
		filterMode,
		statusId,
		genreId,
		formatId,
		tagId,
		authorId,
		seriesId,
		absBaseUrl,
		isAdmin: locals.user?.role === 'admin',
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
