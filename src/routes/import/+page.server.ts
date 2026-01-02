import type { PageServerLoad } from './$types';
import { getStatuses, getFormats, getGenres, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';

export const load: PageServerLoad = async () => {
	const [statuses, formats, genres, authors, series] = await Promise.all([
		getStatuses(),
		getFormats(),
		getGenres(),
		getAllAuthors(),
		getAllSeries()
	]);

	return {
		options: {
			statuses,
			formats,
			genres,
			authors: authors.slice(0, 100),
			series: series.slice(0, 100)
		}
	};
};
