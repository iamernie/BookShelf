import type { PageServerLoad } from './$types';
import { getSeriesWithBooks } from '$lib/server/services/seriesService';
import { getAllTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllNarrators } from '$lib/server/services/narratorService';
import { getAllFormats } from '$lib/server/services/formatService';
import { getAllGenres } from '$lib/server/services/genreService';
import { getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { db, seriesTags, tags } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid series ID');
	}

	const userId = locals.user?.id;

	const [result, allTags, allStatuses, authors, narrators, allSeries, formats, genres] = await Promise.all([
		getSeriesWithBooks(id, userId),
		getAllTags(),
		getAllStatuses(),
		getAllAuthors(),
		getAllNarrators(),
		getAllSeries(),
		getAllFormats(),
		getAllGenres()
	]);

	if (!result) {
		throw error(404, 'Series not found');
	}

	// Get tags for this series
	const seriesTagsList = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon
		})
		.from(seriesTags)
		.innerJoin(tags, eq(seriesTags.tagId, tags.id))
		.where(eq(seriesTags.seriesId, id));

	return {
		series: result.series,
		books: result.books,
		stats: result.stats,
		tags: seriesTagsList,
		allTags,
		options: {
			tags: allTags,
			statuses: allStatuses,
			authors,
			narrators,
			series: allSeries,
			formats,
			genres
		}
	};
};
