import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGenres, createGenre, getGenreByName } from '$lib/server/services/genreService';

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'createdAt' | 'displayOrder' | 'bookCount') || 'displayOrder';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
	const userId = locals.user?.id;

	const result = await getGenres({ page, limit, search, sort, order, userId });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Genre name is required' });
	}

	// Check for duplicate name
	const existing = await getGenreByName(data.name.trim());
	if (existing) {
		throw error(409, { message: 'A genre with this name already exists' });
	}

	const genre = await createGenre({
		name: data.name.trim(),
		description: data.description?.trim() || null,
		color: data.color || null,
		icon: data.icon?.trim() || null,
		displayOrder: data.displayOrder ?? 0
	});

	return json(genre, { status: 201 });
};
