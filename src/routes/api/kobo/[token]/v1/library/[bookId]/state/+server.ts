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

	console.log(`[Kobo ReadingState] GET /library/${bookId}/state`);

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
		console.log(`[Kobo ReadingState] Non-numeric bookId, returning empty`);
		return json({ ReadingStates: [] });
	}

	const state = await getReadingState(user.userId, numericId);

	// Kobo expects the response wrapped in ReadingStates array
	const response = {
		ReadingStates: state ? [state] : []
	};

	console.log(`[Kobo ReadingState] Returning state for book ${bookId}:`, JSON.stringify(response, null, 2));
	return json(response);
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
