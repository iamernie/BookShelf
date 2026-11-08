import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTagById, updateTag, deleteTag, getBooksWithTag, getSeriesWithTag, TAG_COLORS } from '$lib/server/services/tagService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	const tag = await getTagById(id, locals.user);
	if (!tag) {
		throw error(404, { message: 'Tag not found' });
	}

	// Get books and series with this tag (books filtered by user's library)
	const [books, series] = await Promise.all([getBooksWithTag(id, locals.user), getSeriesWithTag(id, locals.user)]);

	return json({ tag, books, series, colors: TAG_COLORS });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	const data = await request.json();

	// Name is optional for system tags
	const tag = await updateTag(id, {
		name: data.name?.trim(),
		color: data.color,
		icon: data.icon?.trim() || null
	});

	if (!tag) {
		throw error(404, { message: 'Tag not found' });
	}

	return json(tag);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	try {
		const deleted = await deleteTag(id);
		if (!deleted) {
			throw error(404, { message: 'Tag not found' });
		}

		return json({ success: true });
	} catch (err) {
		if (err instanceof Error && err.message === 'System tags cannot be deleted') {
			throw error(403, { message: err.message });
		}
		throw err;
	}
};
