import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ignorePair, unignorePair, type EntityType } from '$lib/server/services/ignoredDuplicatesService';

/**
 * POST /api/duplicates/ignore
 * Mark a pair as not duplicates (ignore them)
 * Body: { entityType: 'author' | 'series' | 'book', id1: number, id2: number }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can ignore duplicates
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { entityType, id1, id2 } = body;

	if (!entityType || !['author', 'series', 'book'].includes(entityType)) {
		throw error(400, 'entityType must be "author", "series", or "book"');
	}

	if (typeof id1 !== 'number' || typeof id2 !== 'number') {
		throw error(400, 'id1 and id2 must be numbers');
	}

	if (id1 === id2) {
		throw error(400, 'Cannot ignore a pair with the same ID');
	}

	try {
		const success = await ignorePair(entityType as EntityType, id1, id2, locals.user.id);
		return json({
			success,
			message: success ? 'Pair marked as not duplicates' : 'Pair already ignored'
		});
	} catch (err) {
		console.error('Error ignoring pair:', err);
		return json(
			{ success: false, error: 'Failed to ignore pair' },
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/duplicates/ignore
 * Remove a pair from ignored list (allow it to show as duplicate again)
 * Body: { entityType: 'author' | 'series' | 'book', id1: number, id2: number }
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { entityType, id1, id2 } = body;

	if (!entityType || !['author', 'series', 'book'].includes(entityType)) {
		throw error(400, 'entityType must be "author", "series", or "book"');
	}

	if (typeof id1 !== 'number' || typeof id2 !== 'number') {
		throw error(400, 'id1 and id2 must be numbers');
	}

	try {
		await unignorePair(entityType as EntityType, id1, id2);
		return json({
			success: true,
			message: 'Pair removed from ignored list'
		});
	} catch (err) {
		console.error('Error unignoring pair:', err);
		return json(
			{ success: false, error: 'Failed to unignore pair' },
			{ status: 500 }
		);
	}
};
