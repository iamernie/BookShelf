import type { PageServerLoad } from './$types';
import { getAuthorWithBooks } from '$lib/server/services/authorService';
import { getAllTags, getAuthorTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllNarrators } from '$lib/server/services/narratorService';
import { getAllFormats } from '$lib/server/services/formatService';
import { getAllGenres } from '$lib/server/services/genreService';
import { getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid author ID');
	}

	const userId = locals.user?.id;

	const [result, tags, authorTags, statuses, authors, narrators, allSeries, formats, genres] = await Promise.all([
		getAuthorWithBooks(id, userId),
		getAllTags(),
		getAuthorTags(id),
		getAllStatuses(),
		getAllAuthors(),
		getAllNarrators(),
		getAllSeries(),
		getAllFormats(),
		getAllGenres()
	]);

	if (!result) {
		throw error(404, 'Author not found');
	}

	return {
		author: result.author,
		authorTags,
		books: result.books,
		series: result.series,
		options: {
			tags,
			statuses,
			authors,
			narrators,
			series: allSeries,
			formats,
			genres
		}
	};
};
