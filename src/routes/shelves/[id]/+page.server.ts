import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getShelfById, getShelfBooks } from '$lib/server/services/magicShelfService';
import { db, statuses, genres, formats, authors, series, tags, narrators } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid shelf ID');
	}

	const shelf = await getShelfById(id);
	if (!shelf) {
		throw error(404, 'Shelf not found');
	}

	// Check access
	if (!shelf.isPublic && shelf.userId !== locals.user?.id) {
		throw error(403, 'Access denied');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');

	// Load shelf books and filter options in parallel
	const [result, statusList, genreList, formatList, authorList, seriesList, tagList, narratorList] = await Promise.all([
		getShelfBooks(id, { page, limit }),
		db.select({ id: statuses.id, name: statuses.name }).from(statuses).orderBy(asc(statuses.sortOrder)),
		db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name)),
		db.select({ id: formats.id, name: formats.name }).from(formats).orderBy(asc(formats.name)),
		db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
		db.select({ id: series.id, name: series.title }).from(series).orderBy(asc(series.title)),
		db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
		db.select({ id: narrators.id, name: narrators.name }).from(narrators).orderBy(asc(narrators.name))
	]);

	return {
		shelf: {
			...shelf,
			filterJson: JSON.parse(shelf.filterJson)
		},
		books: result?.books || [],
		pagination: {
			page: result?.page || 1,
			limit: result?.limit || 24,
			total: result?.total || 0,
			totalPages: result?.totalPages || 0
		},
		statuses: statusList,
		genres: genreList,
		formats: formatList,
		authors: authorList,
		series: seriesList.map(s => ({ id: s.id, name: s.name })),
		tags: tagList,
		narrators: narratorList
	};
};
