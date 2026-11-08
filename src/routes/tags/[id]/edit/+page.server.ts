import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getTagById, getBooksWithTag, getSeriesWithTag, TAG_COLORS } from '$lib/server/services/tagService';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!canManageEntities(locals.user ?? null)) {
		throw error(403, 'You do not have permission to edit tags');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Tag not found');
	}

	const tag = await getTagById(id, locals.user);
	if (!tag) {
		throw error(404, 'Tag not found');
	}

	const [books, series] = await Promise.all([
		getBooksWithTag(id, locals.user),
		getSeriesWithTag(id, locals.user)
	]);

	return {
		tag,
		books,
		series,
		colors: TAG_COLORS
	};
};
