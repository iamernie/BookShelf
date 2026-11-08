import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getFormatById, getBooksInFormat, getFormats } from '$lib/server/services/formatService';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!canManageEntities(locals.user ?? null)) {
		throw error(403, 'You do not have permission to edit formats');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Format not found');
	}

	const format = await getFormatById(id, locals.user);
	if (!format) {
		throw error(404, 'Format not found');
	}

	const [books, allFormatsResult] = await Promise.all([
		getBooksInFormat(id, locals.user),
		getFormats({ viewer: locals.user })
	]);

	// Filter out the current format from the list for reassignment options
	const allFormats = allFormatsResult.items.filter(f => f.id !== id);

	return {
		format,
		books,
		allFormats
	};
};
