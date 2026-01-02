import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTags, createTag, getTagByName, TAG_COLORS } from '$lib/server/services/tagService';

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'createdAt' | 'bookCount') || 'name';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
	const userId = locals.user?.id;

	const result = await getTags({ page, limit, search, sort, order, userId });
	return json({ ...result, colors: TAG_COLORS });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Tag name is required' });
	}

	// Check for duplicate name
	const existing = await getTagByName(data.name.trim());
	if (existing) {
		throw error(409, { message: 'A tag with this name already exists' });
	}

	const tag = await createTag({
		name: data.name.trim(),
		color: data.color || '#6c757d',
		icon: data.icon?.trim() || null
	});

	return json(tag, { status: 201 });
};
