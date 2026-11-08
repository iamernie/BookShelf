import type { PageServerLoad } from './$types';
import { getNarratorById, getBooksByNarrator, getNarratorTags } from '$lib/server/services/narratorService';
import { getAllTags } from '$lib/server/services/tagService';
import { getEntityNotes } from '$lib/server/services/entityNotesService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid narrator ID');
	}

	const [narrator, books, narratorTags, tags] = await Promise.all([
		getNarratorById(id, locals.user),
		getBooksByNarrator(id, locals.user),
		getNarratorTags(id),
		getAllTags()
	]);

	if (!narrator) {
		throw error(404, 'Narrator not found');
	}

	// The viewer's own notes only
	const myNotes = locals.user ? await getEntityNotes(locals.user.id, 'narrator', id) : null;

	return {
		narrator,
		books,
		narratorTags,
		myNotes,
		canWriteNotes: hasPermission(locals.user ?? null, Permission.EDIT_OWN_BOOKS),
		options: {
			tags
		}
	};
};
