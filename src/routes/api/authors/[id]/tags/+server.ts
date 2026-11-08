import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getAuthorTags, toggleAuthorTag } from '$lib/server/services/tagService';
import { canReachEntity } from '$lib/server/services/libraryShareService';

// Get tags for an author
export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	if (!(await canReachEntity(locals.user, 'author', id))) {
		throw error(404, { message: 'Author not found' });
	}

	const tags = await getAuthorTags(id);
	return json(tags);
};

// Add a tag to an author
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!canManageEntities(locals.user)) {
		throw error(403, { message: 'You do not have permission to edit authors' });
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
	if (!canManageEntities(locals.user)) {
		throw error(403, { message: 'You do not have permission to edit authors' });
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
