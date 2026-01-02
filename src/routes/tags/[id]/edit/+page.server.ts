import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getTagById, getBooksWithTag, getSeriesWithTag, TAG_COLORS } from '$lib/server/services/tagService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Tag not found');
	}

	const userId = locals.user?.id;
	const tag = await getTagById(id, userId);
	if (!tag) {
		throw error(404, 'Tag not found');
	}

	const [books, series] = await Promise.all([
		getBooksWithTag(id, userId),
		getSeriesWithTag(id)
	]);

	return {
		tag,
		books,
		series,
		colors: TAG_COLORS
	};
};
