import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShelfById, updateShelf, deleteShelf, getShelfBookCount } from '$lib/server/services/magicShelfService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid shelf ID');
	}

	const shelf = await getShelfById(id);
	if (!shelf) {
		throw error(404, 'Shelf not found');
	}

	// Check access
	if (!shelf.isPublic && shelf.userId !== locals.user?.id) {
		throw error(403, 'Access denied');
	}

	const bookCount = await getShelfBookCount(id);

	return json({
		...shelf,
		filterJson: JSON.parse(shelf.filterJson),
		bookCount
	});
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid shelf ID');
	}

	const shelf = await getShelfById(id);
	if (!shelf) {
		throw error(404, 'Shelf not found');
	}

	// Only owner can edit
	if (shelf.userId !== locals.user.id) {
		throw error(403, 'Access denied');
	}

	const body = await request.json();

	const updated = await updateShelf(id, {
		name: body.name?.trim(),
		description: body.description?.trim(),
		icon: body.icon,
		iconColor: body.iconColor,
		filterJson: body.filterJson,
		sortField: body.sortField,
		sortOrder: body.sortOrder,
		isPublic: body.isPublic,
		displayOrder: body.displayOrder
	});

	if (!updated) {
		throw error(500, 'Failed to update shelf');
	}

	return json({
		...updated,
		filterJson: JSON.parse(updated.filterJson)
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid shelf ID');
	}

	const shelf = await getShelfById(id);
	if (!shelf) {
		throw error(404, 'Shelf not found');
	}

	// Only owner can delete
	if (shelf.userId !== locals.user.id) {
		throw error(403, 'Access denied');
	}

	await deleteShelf(id);

	return json({ success: true, message: 'Shelf deleted' });
};
