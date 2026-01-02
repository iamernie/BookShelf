import type { PageServerLoad } from './$types';
import { getSeriesWithBooks } from '$lib/server/services/seriesService';
import { db, seriesTags, tags, statuses, genres } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid series ID');
	}

	const result = await getSeriesWithBooks(id);
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

	// Get all statuses
	const allStatuses = await db
		.select({
			id: statuses.id,
			name: statuses.name,
			color: statuses.color
		})
		.from(statuses)
		.orderBy(asc(statuses.name));

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
		allStatuses,
		allGenres
	};
};
