import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getGenreById, getBooksInGenre } from '$lib/server/services/genreService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Genre not found');
	}

	const genre = await getGenreById(id, locals.user?.id);
	if (!genre) {
		throw error(404, 'Genre not found');
	}

	const books = await getBooksInGenre(id, locals.user?.id);

	return {
		genre,
		books
	};
};
