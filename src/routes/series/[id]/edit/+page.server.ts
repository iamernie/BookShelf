import type { PageServerLoad } from './$types';
import { getSeriesWithBooks } from '$lib/server/services/seriesService';
import { db, seriesTags, tags, seriesStatuses, genres } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid series ID');
	}

	const result = await getSeriesWithBooks(id, locals.user, { storedStatus: true });
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

	// Get all available tags
	const allTags = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon
		})
		.from(tags)
		.orderBy(asc(tags.name));

	// Get all series statuses (series.statusId references seriesstatuses, not book statuses)
	const allSeriesStatuses = await db
		.select({
			id: seriesStatuses.id,
			name: seriesStatuses.name,
			color: seriesStatuses.color
		})
		.from(seriesStatuses)
		.orderBy(asc(seriesStatuses.name));

	// Get all genres
	const allGenres = await db
		.select({
			id: genres.id,
			name: genres.name
		})
		.from(genres)
		.orderBy(asc(genres.name));

	return {
		series: result.series,
		books: result.books,
		stats: result.stats,
		tags: seriesTagsList,
		allTags,
		allSeriesStatuses,
		allGenres
	};
};
