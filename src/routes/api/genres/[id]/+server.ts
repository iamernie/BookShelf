import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGenreById, updateGenre, deleteGenre, getBooksInGenre } from '$lib/server/services/genreService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid genre ID' });
	}

	const userId = locals.user?.id;

	const genre = await getGenreById(id, userId);
	if (!genre) {
		throw error(404, { message: 'Genre not found' });
	}

	// Get books in this genre (filtered by user's library)
	const books = await getBooksInGenre(id, userId);

	return json({ genre, books });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid genre ID' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Genre name is required' });
	}

	const genre = await updateGenre(id, {
		name: data.name.trim(),
		description: data.description?.trim() || null,
		color: data.color || null,
		icon: data.icon?.trim() || null,
		displayOrder: data.displayOrder ?? 0
	});

	if (!genre) {
		throw error(404, { message: 'Genre not found' });
	}

	return json(genre);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid genre ID' });
	}

	try {
		const deleted = await deleteGenre(id);
		if (!deleted) {
			throw error(404, { message: 'Genre not found' });
		}

		return json({ success: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('Cannot delete genre')) {
			throw error(400, { message: err.message });
		}
		throw err;
	}
};
