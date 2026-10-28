import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyStatusChange } from '$lib/server/services/statusService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, statusId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (typeof statusId !== 'number') {
		throw error(400, 'statusId must be a number');
	}

	// Books already in this status are left alone (no re-stamping, no repeat notifications)
	await applyStatusChange(bookIds, statusId, { source: 'bulk', userId: locals.user.id });

	return json({
		success: true,
		updated: bookIds.length,
		message: `Status updated for ${bookIds.length} book(s)`
	});
};
