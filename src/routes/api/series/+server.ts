import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllSeries, createSeries, checkSeriesRefId } from '$lib/server/services/seriesService';

export const GET: RequestHandler = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'title' | 'bookCount' | 'createdAt') || 'title';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';

	const result = await getAllSeries({ page, limit, search, sort, order });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.title?.trim()) {
		throw error(400, { message: 'Title is required' });
	}

	const status = await checkSeriesRefId(data.statusId, 'status');
	if (!status.valid) {
		throw error(400, { message: 'Unknown series status' });
	}

	const genre = await checkSeriesRefId(data.genreId, 'genre');
	if (!genre.valid) {
		throw error(400, { message: 'Unknown genre' });
	}

	const newSeries = await createSeries({
		title: data.title.trim(),
		description: data.description?.trim() || null,
		numBooks: data.numBooks || null,
		comments: data.comments?.trim() || null,
		statusId: status.id,
		genreId: genre.id
	});

	return json(newSeries, { status: 201 });
};
