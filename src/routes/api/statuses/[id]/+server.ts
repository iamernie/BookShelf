import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStatusById, updateStatusName, getBooksByStatus } from '$lib/server/services/statusService';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid status ID' });
	}

	const status = await getStatusById(id);
	if (!status) {
		throw error(404, { message: 'Status not found' });
	}

	const books = await getBooksByStatus(id);

	return json({ status, books });
};

// Only allow updating the name (for localization)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid status ID' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Status name is required' });
	}

	const status = await updateStatusName(id, data.name.trim());

	if (!status) {
		throw error(404, { message: 'Status not found' });
	}

	return json(status);
};

// Note: No DELETE - statuses are system-defined and cannot be deleted
