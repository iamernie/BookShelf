import type { PageServerLoad } from './$types';
import { getAuthors } from '$lib/server/services/authorService';
import { getGenres } from '$lib/server/services/genreService';
import { getTags } from '$lib/server/services/tagService';
import { getAllSeries } from '$lib/server/services/seriesService';
import { getNarrators } from '$lib/server/services/narratorService';
import { getFormats } from '$lib/server/services/formatService';
import { getStatuses } from '$lib/server/services/statusService';

export const load: PageServerLoad = async ({ url }) => {
	const tab = url.searchParams.get('tab') || 'authors';
	const search = url.searchParams.get('search') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 50;

	// Load data based on active tab
	let items: unknown[] = [];
	let total = 0;

	switch (tab) {
		case 'authors': {
			const result = await getAuthors({ search, page, limit });
			items = result.items;
			total = result.total;
			break;
		}
		case 'genres': {
			const result = await getGenres({ search });
			items = result.items;
			total = result.total;
			break;
		}
		case 'tags': {
			const result = await getTags({ search });
			items = result.items;
			total = result.total;
			break;
		}
		case 'series': {
			const result = await getAllSeries({ search, page, limit });
			items = result.items;
			total = result.total;
			break;
		}
		case 'narrators': {
			const result = await getNarrators({ search });
			items = result.items;
			total = result.total;
			break;
		}
		case 'formats': {
			const result = await getFormats({ search });
			items = result.items;
			total = result.total;
			break;
		}
		case 'statuses': {
			const statusList = await getStatuses();
			items = statusList;
			total = statusList.length;
			break;
		}
	}

	return {
		tab,
		search,
		page,
		limit,
		items,
		total
	};
};
