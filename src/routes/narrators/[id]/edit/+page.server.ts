import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getNarratorById, getNarratorTags } from '$lib/server/services/narratorService';
import { getAllTags } from '$lib/server/services/tagService';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!canManageEntities(locals.user ?? null)) {
		throw error(403, 'You do not have permission to edit narrators');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Narrator not found');
	}

	const [narrator, narratorTags, allTags] = await Promise.all([
		getNarratorById(id, locals.user),
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
