import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { previewFilter } from '$lib/server/services/magicShelfService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	if (!body.filterJson) {
		throw error(400, 'Filter rules are required');
	}

	const page = body.page || 1;
	const limit = body.limit || 24;

	const result = await previewFilter(body.filterJson, { page, limit });

	return json(result);
};
