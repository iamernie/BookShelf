/**
 * Account Password API
 * POST /api/account/password - Change password
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { changePassword } from '$lib/server/services/userService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const { currentPassword, newPassword } = body;

	if (!currentPassword || !newPassword) {
		throw error(400, 'Current password and new password are required');
	}

	const result = await changePassword(locals.user.id, currentPassword, newPassword);

	if (!result.success) {
		throw error(400, result.error || 'Failed to change password');
	}

	return json({ success: true, message: 'Password changed successfully' });
};
