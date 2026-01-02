import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';

export const GET: RequestHandler = async () => {
	const [statuses, genres, formats, narrators, tags, authors, series] = await Promise.all([
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries()
	]);

	return json({
		statuses,
		genres,
		formats,
		narrators,
		tags,
		authors,
		series
	});
};
