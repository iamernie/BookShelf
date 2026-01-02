import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getBookById, getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { getAudiobooksByBookId } from '$lib/server/services/audiobookService';
import { getAllMediaSources, getBookMediaSources } from '$lib/server/services/mediaSourceService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Book not found');
	}

	const book = await getBookById(id);
	if (!book) {
		throw error(404, 'Book not found');
	}

	const [statuses, genres, formats, narrators, tags, authors, series, linkedAudiobooks, mediaSources, bookMediaSources] = await Promise.all([
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries(),
		locals.user ? getAudiobooksByBookId(id, locals.user.id) : Promise.resolve([]),
		getAllMediaSources(locals.user?.id),
		getBookMediaSources(id)
	]);

	return {
		book,
		linkedAudiobooks,
		bookMediaSources,
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
