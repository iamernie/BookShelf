import type { PageServerLoad } from './$types';
import { getAllSeries } from '$lib/server/services/seriesService';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'title' | 'bookCount' | 'createdAt') || 'title';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
	const userId = locals.user?.id;

	const result = await getAllSeries({ page, limit: 24, search, sort, order, userId });

	return {
		...result,
		search: search || '',
		sort,
		order
	};
};
