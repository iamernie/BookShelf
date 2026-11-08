import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canReachEntity } from '$lib/server/services/libraryShareService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { putEntityNotes } from '$lib/server/services/entityNotesService';

// PUT /api/authors/[id]/notes - Save the caller's own notes on an author ({ notes: string | null }; empty deletes)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!hasPermission(locals.user, Permission.EDIT_OWN_BOOKS)) {
		throw error(403, { message: 'You do not have permission to write notes' });
	}

	const authorId = parseInt(params.id);
	// An unreachable author 404s the same as a missing one
	if (isNaN(authorId) || !(await canReachEntity(locals.user, 'author', authorId))) {
		throw error(404, { message: 'Author not found' });
	}

	const body = await request.json().catch(() => null);
	const notes: unknown = body?.notes;
	if (notes !== null && typeof notes !== 'string') {
		throw error(400, { message: 'notes must be a string or null' });
	}

	const saved = await putEntityNotes(locals.user.id, 'author', authorId, notes);
	return json({ notes: saved });
};
