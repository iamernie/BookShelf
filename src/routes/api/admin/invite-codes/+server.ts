import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAllInviteCodes,
	createInviteCode,
	deactivateInviteCode,
	activateInviteCode,
	deleteInviteCode,
	updateInviteCode
} from '$lib/server/services/inviteCodeService';

// GET - List all invite codes
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const codes = await getAllInviteCodes();
	return json({ codes });
};

// POST - Create new invite code
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { label, maxUses, expiresAt } = body;

	const code = await createInviteCode(
		{
			label,
			maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
			expiresAt
		},
		locals.user.id
	);

	return json({ code });
};

// PUT - Update invite code
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { id, label, maxUses, expiresAt, isActive } = body;

	if (!id) {
		throw error(400, 'Invite code ID is required');
	}

	const updated = await updateInviteCode(id, {
		label,
		maxUses: maxUses !== undefined ? (maxUses === null ? null : parseInt(maxUses, 10)) : undefined,
		expiresAt,
		isActive
	});

	if (!updated) {
		throw error(404, 'Invite code not found');
	}

	return json({ code: updated });
};

// DELETE - Delete invite code
export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { id } = body;

	if (!id) {
		throw error(400, 'Invite code ID is required');
	}

	const deleted = await deleteInviteCode(id);

	if (!deleted) {
		throw error(404, 'Invite code not found');
	}

	return json({ success: true });
};
