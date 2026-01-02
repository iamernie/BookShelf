import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPendingApprovals, approveUser, rejectUser } from '$lib/server/services/authService';

// GET - List pending approvals
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const pending = await getPendingApprovals();
	return json({ pending });
};

// POST - Approve or reject a user
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { userId, action } = body;

	if (!userId) {
		throw error(400, 'User ID is required');
	}

	if (action !== 'approve' && action !== 'reject') {
		throw error(400, 'Action must be "approve" or "reject"');
	}

	let result;
	if (action === 'approve') {
		result = await approveUser(userId, locals.user.id);
	} else {
		result = await rejectUser(userId, locals.user.id);
	}

	if (!result.success) {
		throw error(400, result.error || 'Operation failed');
	}

	return json({ success: true });
};
