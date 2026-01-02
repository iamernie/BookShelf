/**
 * Admin User API (single user)
 * GET /api/admin/users/:id - Get user details
 * PATCH /api/admin/users/:id - Update user
 * DELETE /api/admin/users/:id - Delete user
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserById, updateUser, deleteUser, unlockUser } from '$lib/server/services/userService';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Check admin permission
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid user ID');
	}

	const user = await getUserById(id);
	if (!user) {
		throw error(404, 'User not found');
	}

	return json({ user });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	// Check admin permission
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid user ID');
	}

	// Prevent admin from changing their own role
	if (locals.user.id === id) {
		const body = await request.json();
		if (body.role && body.role !== locals.user.role) {
			throw error(400, 'Cannot change your own role');
		}
	}

	const body = await request.json();

	// Handle unlock action
	if (body.action === 'unlock') {
		const result = await unlockUser(id);
		if (!result.success) {
			throw error(400, result.error || 'Failed to unlock user');
		}
		return json({ success: true, message: 'User unlocked' });
	}

	const { username, email, password, role, firstName, lastName } = body;

	const result = await updateUser(id, {
		username,
		email,
		password,
		role,
		firstName,
		lastName
	});

	if (!result.success) {
		throw error(400, result.error || 'Failed to update user');
	}

	return json({ success: true, user: result.user });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check admin permission
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid user ID');
	}

	// Prevent admin from deleting themselves
	if (locals.user.id === id) {
		throw error(400, 'Cannot delete your own account');
	}

	const result = await deleteUser(id);
	if (!result.success) {
		throw error(400, result.error || 'Failed to delete user');
	}

	return json({ success: true, message: 'User deleted' });
};
