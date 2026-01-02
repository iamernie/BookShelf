/**
 * Account API
 * GET /api/account - Get current user profile
 * PATCH /api/account - Update current user profile
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserById, updateUser } from '$lib/server/services/userService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const user = await getUserById(locals.user.id);
	if (!user) {
		throw error(404, 'User not found');
	}

	// Don't return sensitive fields
	return json({
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			createdAt: user.createdAt
		}
	});
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const { username, email, firstName, lastName } = body;

	// Users can only update their own profile, not role
	const result = await updateUser(locals.user.id, {
		username,
		email,
		firstName,
		lastName
	});

	if (!result.success) {
		throw error(400, result.error || 'Failed to update profile');
	}

	return json({
		success: true,
		user: {
			id: result.user!.id,
			username: result.user!.username,
			email: result.user!.email,
			firstName: result.user!.firstName,
			lastName: result.user!.lastName,
			role: result.user!.role
		}
	});
};
