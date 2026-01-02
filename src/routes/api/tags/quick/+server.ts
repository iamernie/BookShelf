import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { quickCreateTag } from '$lib/server/services/tagService';

// Quick create a tag with default color (for use in forms)
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Tag name is required' });
	}

	try {
		const tag = await quickCreateTag(data.name);
		return json(tag, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message.includes('already exists')) {
			throw error(409, { message: err.message });
		}
		throw err;
	}
};
