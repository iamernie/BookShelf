import { json, error } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { canReachEntity, promoteEntityBooks, unshareEntityBooks } from '$lib/server/services/libraryShareService';
import { isAdmin } from '$lib/server/services/permissionService';

// The caller and a narrator they can reach: 401 without a session, 404 when missing or out of reach
async function reached({ params, locals }: RequestEvent) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	const id = parseInt(params.id);
	if (isNaN(id) || !(await canReachEntity(locals.user, 'narrator', id))) {
		throw error(404, { message: 'Narrator not found' });
	}
	return { user: locals.user, id };
}

// GET /api/narrators/[id]/share - Preview: how many books the caller would share (admins also see the public and skipped counts)
export const GET: RequestHandler = async (event) => {
	const { user, id } = await reached(event);
	return json(await promoteEntityBooks(user, 'narrator', id, { dryRun: true }));
};

// POST /api/narrators/[id]/share - Share every book of the narrator the caller may promote (the single-book promote rule)
export const POST: RequestHandler = async (event) => {
	const { user, id } = await reached(event);
	if ((await promoteEntityBooks(user, 'narrator', id, { dryRun: true })).promoted === 0) {
		throw error(403, { message: 'No books in this narrator that you can share' });
	}
	return json(await promoteEntityBooks(user, 'narrator', id));
};

// DELETE /api/narrators/[id]/share - Admins only: move every public book of the narrator back to personal
export const DELETE: RequestHandler = async (event) => {
	const { user, id } = await reached(event);
	if (!isAdmin(user)) {
		throw error(403, { message: 'Only admins can un-share a narrator' });
	}
	return json(await unshareEntityBooks(user, 'narrator', id));
};
