import type { PageServerLoad } from './$types';
import { db, statuses, genres, formats, authors, series, tags, narrators } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Load all options for the rule builder
	const [statusList, genreList, formatList, authorList, seriesList, tagList, narratorList] = await Promise.all([
		db.select({ id: statuses.id, name: statuses.name }).from(statuses).orderBy(asc(statuses.sortOrder)),
		db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name)),
		db.select({ id: formats.id, name: formats.name }).from(formats).orderBy(asc(formats.name)),
		db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
		db.select({ id: series.id, name: series.title }).from(series).orderBy(asc(series.title)),
		db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
		db.select({ id: narrators.id, name: narrators.name }).from(narrators).orderBy(asc(narrators.name))
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
