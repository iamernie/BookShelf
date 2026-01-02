import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getFormatById, getBooksInFormat, getFormats } from '$lib/server/services/formatService';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Format not found');
	}

	const format = await getFormatById(id);
	if (!format) {
		throw error(404, 'Format not found');
	}

	const [books, allFormatsResult] = await Promise.all([
		getBooksInFormat(id),
		getFormats({})
	]);

	// Filter out the current format from the list for reassignment options
	const allFormats = allFormatsResult.items.filter(f => f.id !== id);

	return {
		format,
		books,
		allFormats
	};
};
