import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShelfById, getShelfBooks } from '$lib/server/services/magicShelfService';

export const GET: RequestHandler = async ({ params, url, locals }) => {
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

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');

	const result = await getShelfBooks(id, { page, limit });
	if (!result) {
		throw error(500, 'Failed to get shelf books');
	}

	return json({
		shelf: {
			id: shelf.id,
			name: shelf.name,
			description: shelf.description,
			icon: shelf.icon,
			iconColor: shelf.iconColor
		},
		...result
	});
};
