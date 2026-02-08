import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getToken,
	revokeToken,
	updateTokenName
} from '$lib/server/services/apiTokenService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const tokenId = parseInt(params.id);
	if (isNaN(tokenId)) {
		throw error(400, 'Invalid token ID');
	}

	const token = await getToken(tokenId, locals.user.id);
	if (!token) {
		throw error(404, 'Token not found');
	}

	return json(token);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const tokenId = parseInt(params.id);
	if (isNaN(tokenId)) {
		throw error(400, 'Invalid token ID');
	}

	const body = await request.json();
	const { name } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		throw error(400, 'Token name is required');
	}

	if (name.length > 100) {
		throw error(400, 'Token name must be 100 characters or less');
	}

	const result = await updateTokenName(tokenId, locals.user.id, name.trim());
	if (!result.success) {
		throw error(404, result.error || 'Token not found');
	}

	const token = await getToken(tokenId, locals.user.id);
	return json(token);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const tokenId = parseInt(params.id);
	if (isNaN(tokenId)) {
		throw error(400, 'Invalid token ID');
	}

	const result = await revokeToken(tokenId, locals.user.id);
	if (!result.success) {
		throw error(404, result.error || 'Token not found');
	}

	return json({ success: true });
};
