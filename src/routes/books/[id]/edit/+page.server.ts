import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getBookById, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { getAllMediaSources, getBookMediaSources } from '$lib/server/services/mediaSourceService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Book not found');
	}

	const book = await getBookById(id);
	if (!book) {
		throw error(404, 'Book not found');
	}

	const [statuses, genres, formats, narrators, tags, authors, series, mediaSources, bookMediaSources, absBaseUrl] = await Promise.all([
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries(),
		getAllMediaSources(locals.user?.id),
		getBookMediaSources(id),
		getAbsLinkBaseUrl()
	]);

	return {
		book,
		bookMediaSources,
		absBaseUrl,
		isAdmin: locals.user?.role === 'admin',
		options: {
			statuses,
			genres,
			formats,
			narrators,
			tags,
			authors,
			series,
			mediaSources
		}
	};
};
