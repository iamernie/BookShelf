import type { PageServerLoad } from './$types';
import { getSeriesWithBooks } from '$lib/server/services/seriesService';
import { getAllTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllNarrators } from '$lib/server/services/narratorService';
import { getAllFormats } from '$lib/server/services/formatService';
import { getAllGenres } from '$lib/server/services/genreService';
import { getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { getSeriesSuggestions } from '$lib/server/services/audibleSuggestService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { db, seriesTags, tags } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid series ID');
	}

	const userId = locals.user?.id;

	// The gate first: nothing else about a series the viewer can't reach is loaded
	const result = await getSeriesWithBooks(id, locals.user);
	if (!result) {
		throw error(404, 'Series not found');
	}

	// The author, narrator and series pickers feed the catalog editors' bulk edit only
	const canEdit = hasPermission(locals.user ?? null, Permission.MANAGE_ENTITIES);
	const none = Promise.resolve([] as { id: number; name: string }[]);

	const [allTags, allStatuses, authors, narrators, allSeries, formats, genres, audible] = await Promise.all([
		getAllTags(),
		getAllStatuses(),
		canEdit ? getAllAuthors(locals.user) : none,
		canEdit ? getAllNarrators(locals.user) : none,
		canEdit ? getAllSeries(locals.user) : Promise.resolve([] as { id: number; title: string }[]),
		getAllFormats(),
		getAllGenres(),
		// Saved Audible list only: never calls Audible on page load
		userId ? getSeriesSuggestions(id, userId) : Promise.resolve(null)
	]);

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
		audible,
		canAddBooks: hasPermission(locals.user ?? null, Permission.ADD_BOOKS),
		isAdmin: locals.user?.role === 'admin',
		canEdit,
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
