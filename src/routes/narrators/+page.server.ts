import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getNarrators, type NarratorSort } from '$lib/server/services/narratorService';
import { getTagById } from '$lib/server/services/tagService';
import { browseCookieName, pastEndRedirect, resolveBrowse } from '$lib/utils/browse';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	// URL params win; the saved browse cookie fills in sort, order, limit and the view
	const { view, sort, order, limit, page } = resolveBrowse('narrators', url.searchParams, cookies.get(browseCookieName('narrators')));
	const search = url.searchParams.get('search') || undefined;
	// Narrator detail pages link here with ?tag=N
	const tagParam = parseInt(url.searchParams.get('tag') || '', 10);
	const tagId = Number.isSafeInteger(tagParam) && tagParam > 0 ? tagParam : undefined;
	const [result, tag] = await Promise.all([
		getNarrators({ page, limit, search, sort: sort as NarratorSort, order, viewer: locals.user, tagId, includeStats: true }),
		tagId ? getTagById(tagId) : Promise.resolve(null)
	]);

	const pastEnd = pastEndRedirect(url, { page, limit, total: result.total, count: result.items.length });
	if (pastEnd) redirect(302, pastEnd);

	return {
		...result,
		search: search || '',
		tag: tag ? { id: tag.id, name: tag.name } : null,
		view,
		sort,
		order
	};
};
