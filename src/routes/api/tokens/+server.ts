import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createToken,
	listTokens,
	revokeAllTokens
} from '$lib/server/services/apiTokenService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const tokens = await listTokens(locals.user.id);
	return json(tokens);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { name, permissions, expiresAt } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		throw error(400, 'Token name is required');
	}

	if (name.length > 100) {
		throw error(400, 'Token name must be 100 characters or less');
	}

	let parsedExpiresAt: string | null = null;
	if (expiresAt) {
		const date = new Date(expiresAt);
		if (isNaN(date.getTime())) {
			throw error(400, 'Invalid expiration date');
		}
		if (date < new Date()) {
			throw error(400, 'Expiration date must be in the future');
		}
		parsedExpiresAt = date.toISOString();
	}

	let parsedPermissions: string[] | null = null;
	if (permissions && Array.isArray(permissions)) {
		parsedPermissions = permissions.filter((p) => typeof p === 'string');
	}

	const result = await createToken(
		locals.user.id,
		name.trim(),
		parsedPermissions,
		parsedExpiresAt
	);

	if (!result.success) {
		throw error(500, result.error || 'Failed to create token');
	}

	return json(
		{
			token: result.token,
			...result.tokenInfo
		},
		{ status: 201 }
	);
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const result = await revokeAllTokens(locals.user.id);
	return json({ success: true, revokedCount: result.count });
};
