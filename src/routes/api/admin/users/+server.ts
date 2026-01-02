/**
 * Admin Users API
 * GET /api/admin/users - List users with pagination
 * POST /api/admin/users - Create new user
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUsers, createUser, getUserCountsByRole, VALID_ROLES } from '$lib/server/services/userService';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Check admin permission
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const search = url.searchParams.get('search') || undefined;
	const sortBy = url.searchParams.get('sortBy') as 'username' | 'email' | 'role' | 'createdAt' | undefined;
	const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;

	const result = await getUsers({ page, limit, search, sortBy, sortOrder });
	const roleCounts = await getUserCountsByRole();

	return json({
		...result,
		roleCounts,
		roles: VALID_ROLES
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	// Check admin permission
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { username, email, password, role, firstName, lastName } = body;

	if (!username || !email || !password) {
		throw error(400, 'Username, email, and password are required');
	}

	const result = await createUser({
		username,
		email,
		password,
		role,
		firstName,
		lastName
	});

	if (!result.success) {
		throw error(400, result.error || 'Failed to create user');
	}

	return json({ success: true, user: result.user }, { status: 201 });
};
