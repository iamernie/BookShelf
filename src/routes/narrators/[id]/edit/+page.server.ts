import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getNarratorById, getNarratorTags } from '$lib/server/services/narratorService';
import { getAllTags } from '$lib/server/services/tagService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Narrator not found');
	}

	const [narrator, narratorTags, allTags] = await Promise.all([
		getNarratorById(id, locals.user?.id),
		getNarratorTags(id),
		getAllTags()
	]);

	if (!narrator) {
		throw error(404, 'Narrator not found');
	}

	return {
		narrator,
		narratorTags,
		allTags
	};
};
