import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFormats, createFormat, getFormatByName } from '$lib/server/services/formatService';

export const GET: RequestHandler = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'createdAt' | 'bookCount') || 'name';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';

	const result = await getFormats({ page, limit, search, sort, order });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Format name is required' });
	}

	const existing = await getFormatByName(data.name.trim());
	if (existing) {
		throw error(409, { message: 'A format with this name already exists' });
	}

	const format = await createFormat({
		name: data.name.trim(),
		icon: data.icon,
		color: data.color
	});

	return json(format, { status: 201 });
};
