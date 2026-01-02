import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllShelves, createShelf, getShelfBookCounts } from '$lib/server/services/magicShelfService';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;

	const shelves = await getAllShelves(userId);

	// Get book counts for all shelves
	const shelfIds = shelves.map(s => s.id);
	const counts = await getShelfBookCounts(shelfIds);

	// Attach counts to shelves
	const shelvesWithCounts = shelves.map(shelf => ({
		...shelf,
		filterJson: JSON.parse(shelf.filterJson),
		bookCount: counts.get(shelf.id) || 0
	}));

	return json(shelvesWithCounts);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	if (!body.name?.trim()) {
		throw error(400, 'Name is required');
	}

	if (!body.filterJson) {
		throw error(400, 'Filter rules are required');
	}

	const shelf = await createShelf({
		name: body.name.trim(),
		description: body.description?.trim(),
		icon: body.icon,
		iconColor: body.iconColor,
		filterJson: body.filterJson,
		sortField: body.sortField,
		sortOrder: body.sortOrder,
		isPublic: body.isPublic || false,
		userId: locals.user.id
	});

	return json({
		...shelf,
		filterJson: JSON.parse(shelf.filterJson)
	}, { status: 201 });
};
