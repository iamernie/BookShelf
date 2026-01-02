import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSeriesWithBooks, updateSeries, deleteSeries } from '$lib/server/services/seriesService';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const result = await getSeriesWithBooks(id);
	if (!result) {
		throw error(404, { message: 'Series not found' });
	}

	return json(result);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const data = await request.json();

	// Build update object with only provided fields (for partial updates)
	const updateData: Record<string, unknown> = {};

	// Title is required only for full updates, not partial updates
	if (data.title !== undefined) {
		if (!data.title?.trim()) {
			throw error(400, { message: 'Title cannot be empty' });
		}
		updateData.title = data.title.trim();
	}

	if (data.description !== undefined) {
		updateData.description = data.description?.trim() || null;
	}

	if (data.numBooks !== undefined) {
		updateData.numBooks = data.numBooks || null;
	}

	if (data.comments !== undefined) {
		updateData.comments = data.comments?.trim() || null;
	}

	if (data.statusId !== undefined) {
		updateData.statusId = data.statusId || null;
	}

	if (data.genreId !== undefined) {
		updateData.genreId = data.genreId || null;
	}

	// Require at least one field to update
	if (Object.keys(updateData).length === 0) {
		throw error(400, { message: 'No fields to update' });
	}

	const updated = await updateSeries(id, updateData);

	if (!updated) {
		throw error(404, { message: 'Series not found' });
	}

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	const deleted = await deleteSeries(id);
	if (!deleted) {
		throw error(404, { message: 'Series not found' });
	}

	return json({ success: true });
};
