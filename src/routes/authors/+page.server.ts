import type { PageServerLoad } from './$types';
import { getAuthors } from '$lib/server/services/authorService';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'bookCount' | 'createdAt') || 'name';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
	const userId = locals.user?.id;

	const result = await getAuthors({ page, limit: 24, search, sort, order, userId });

	return {
		...result,
		search: search || '',
		sort,
		order
	};
};
