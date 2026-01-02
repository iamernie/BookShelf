import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNarrators, createNarrator, getNarratorByName } from '$lib/server/services/narratorService';

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'createdAt' | 'bookCount') || 'name';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
	const userId = locals.user?.id;

	const result = await getNarrators({ page, limit, search, sort, order, userId });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Narrator name is required' });
	}

	const existing = await getNarratorByName(data.name.trim());
	if (existing) {
		throw error(409, { message: 'A narrator with this name already exists' });
	}

	const narrator = await createNarrator({
		name: data.name.trim(),
		bio: data.bio?.trim() || null,
		website: data.website?.trim() || null
	});

	return json(narrator, { status: 201 });
};
