import type { PageServerLoad } from './$types';
import { db, statuses, genres, formats, authors, series, tags, narrators } from '$lib/server/db';
import { asc, sql } from 'drizzle-orm';
import { reachableEntityCond } from '$lib/server/services/libraryShareService';

export const load: PageServerLoad = async ({ locals }) => {
	// Load all options for the rule builder; entity pickers list only what the viewer can see
	const [statusList, genreList, formatList, authorList, seriesList, tagList, narratorList] = await Promise.all([
		db.select({ id: statuses.id, name: statuses.name }).from(statuses).orderBy(asc(statuses.sortOrder)),
		db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name)),
		db.select({ id: formats.id, name: formats.name }).from(formats).orderBy(asc(formats.name)),
		db.select({ id: authors.id, name: authors.name }).from(authors).where(reachableEntityCond(locals.user, 'author', sql`${authors.id}`)).orderBy(asc(authors.name)),
		db.select({ id: series.id, name: series.title }).from(series).where(reachableEntityCond(locals.user, 'series', sql`${series.id}`)).orderBy(asc(series.title)),
		db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
		db.select({ id: narrators.id, name: narrators.name }).from(narrators).where(reachableEntityCond(locals.user, 'narrator', sql`${narrators.id}`)).orderBy(asc(narrators.name))
	]);

	return {
		statuses: statusList,
		genres: genreList,
		formats: formatList,
		authors: authorList,
		series: seriesList.map(s => ({ id: s.id, name: s.name })),
		tags: tagList,
		narrators: narratorList
	};
};
