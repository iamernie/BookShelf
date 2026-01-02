import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorTags, toggleAuthorTag } from '$lib/server/services/tagService';

// Get tags for an author
export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const tags = await getAuthorTags(id);
	return json(tags);
};

// Add a tag to an author
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const data = await request.json();
	if (!data.tagId) {
		throw error(400, { message: 'Tag ID is required' });
	}

	const tagId = parseInt(data.tagId);
	if (isNaN(tagId)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	const result = await toggleAuthorTag(id, tagId);
	return json({ success: true, ...result });
};

// Remove a tag from an author
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const data = await request.json();
	if (!data.tagId) {
		throw error(400, { message: 'Tag ID is required' });
	}

	const tagId = parseInt(data.tagId);
	if (isNaN(tagId)) {
		throw error(400, { message: 'Invalid tag ID' });
	}

	const result = await toggleAuthorTag(id, tagId);
	return json({ success: true, ...result });
};
