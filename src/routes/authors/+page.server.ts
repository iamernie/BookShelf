import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAuthors, type AuthorSort } from '$lib/server/services/authorService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { browseCookieName, pastEndRedirect, resolveBrowse } from '$lib/utils/browse';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	// URL params win; the saved browse cookie fills in sort, order, limit and the view
	const { view, sort, order, limit, page } = resolveBrowse('authors', url.searchParams, cookies.get(browseCookieName('authors')));
	const search = url.searchParams.get('search') || undefined;

	const result = await getAuthors({ page, limit, search, sort: sort as AuthorSort, order, viewer: locals.user });

	const pastEnd = pastEndRedirect(url, { page, limit, total: result.total, count: result.items.length });
	if (pastEnd) redirect(302, pastEnd);

	return {
		...result,
		search: search || '',
		// Add creates through the same open route the book forms use
		canCreate: hasPermission(locals.user ?? null, Permission.ADD_BOOKS),
		view,
		sort,
		order
	};
};
