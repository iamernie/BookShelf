/**
 * Kobo Reading State API
 *
 * GET /api/kobo/[token]/v1/library/[bookId]/state
 * PUT /api/kobo/[token]/v1/library/[bookId]/state
 *
 * Get or update reading state for a book.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';
import {
	getReadingState,
	saveReadingState,
	type KoboReadingStateUpdate
} from '$lib/server/services/koboReadingStateService';

export const GET: RequestHandler = async ({ params }) => {
	const { token, bookId } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		// Non-numeric ID - proxy to Kobo store would go here
		return json({});
	}

	const state = await getReadingState(user.userId, numericId);
	return json(state);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const { token, bookId } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Check if this is a numeric ID (local book)
	const numericId = parseInt(bookId, 10);
	if (isNaN(numericId)) {
		// Non-numeric ID - proxy to Kobo store would go here
		return json({});
	}

	// Parse the reading state update from request body
	const body = await request.json();

	// Kobo sends reading states in a wrapper
	const readingStates: KoboReadingStateUpdate[] = body.ReadingStates || [body];

	const results = [];
	for (const state of readingStates) {
		const result = await saveReadingState(user.userId, numericId, state);
		results.push(result);
	}

	return json({ RequestResult: 'Success', UpdateResults: results });
};
