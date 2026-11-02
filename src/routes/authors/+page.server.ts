import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAuthors, type AuthorSort } from '$lib/server/services/authorService';
import { browseCookieName, pastEndRedirect, resolveBrowse } from '$lib/utils/browse';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	// URL params win; the saved browse cookie fills in sort, order, limit and the view
	const { view, sort, order, limit, page } = resolveBrowse('authors', url.searchParams, cookies.get(browseCookieName('authors')));
	const search = url.searchParams.get('search') || undefined;
	const userId = locals.user?.id;

	const result = await getAuthors({ page, limit, search, sort: sort as AuthorSort, order, userId });

	const pastEnd = pastEndRedirect(url, { page, limit, total: result.total, count: result.items.length });
	if (pastEnd) redirect(302, pastEnd);

	return {
		...result,
		search: search || '',
		view,
		sort,
		order
	};
};
