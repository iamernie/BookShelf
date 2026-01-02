/**
 * API: /api/audiobooks/[id]/library
 * Manage an audiobook's library type and user's personal library association.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, audiobooks } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import {
	addAudiobookToUserLibrary,
	removeAudiobookFromUserLibrary,
	getUserAudiobookEntry,
	updateUserAudiobookEntry,
	setAudiobookLibraryType
} from '$lib/server/services/audiobookService';
import type { LibraryType } from '$lib/server/db/schema';

/**
 * GET /api/audiobooks/[id]/library
 * Get user's relationship with this audiobook (is it in their library? personal data?)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	// Get the audiobook's library type
	const [audiobook] = await db
		.select({ id: audiobooks.id, libraryType: audiobooks.libraryType })
		.from(audiobooks)
		.where(eq(audiobooks.id, audiobookId))
		.limit(1);

	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Get user's personal data for this audiobook
	const userAudiobook = await getUserAudiobookEntry(locals.user.id, audiobookId);

	return json({
		audiobookId,
		libraryType: audiobook.libraryType,
		inUserLibrary: !!userAudiobook,
		userAudiobook: userAudiobook || null
	});
};

/**
 * POST /api/audiobooks/[id]/library
 * Add an audiobook to the user's personal library
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	// Check if audiobook exists
	const [audiobook] = await db
		.select({ id: audiobooks.id })
		.from(audiobooks)
		.where(eq(audiobooks.id, audiobookId))
		.limit(1);

	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	const body = await request.json().catch(() => ({}));

	// Add to user's library
	const userAudiobook = await addAudiobookToUserLibrary(locals.user.id, audiobookId, {
		statusId: body.statusId,
		rating: body.rating,
		comments: body.comments
	});

	return json({
		success: true,
		message: 'Audiobook added to your library',
		userAudiobook
	});
};

/**
 * PUT /api/audiobooks/[id]/library
 * Update user's personal data for an audiobook
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const body = await request.json();

	const userAudiobook = await updateUserAudiobookEntry(locals.user.id, audiobookId, {
		statusId: body.statusId,
		rating: body.rating,
		comments: body.comments
	});

	if (!userAudiobook) {
		throw error(404, 'Audiobook not in your library');
	}

	return json({
		success: true,
		userAudiobook
	});
};

/**
 * DELETE /api/audiobooks/[id]/library
 * Remove an audiobook from the user's personal library
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	await removeAudiobookFromUserLibrary(locals.user.id, audiobookId);

	return json({
		success: true,
		message: 'Audiobook removed from your library'
	});
};

/**
 * PATCH /api/audiobooks/[id]/library
 * Change the audiobook's library type (personal <-> public)
 * Requires librarian/admin permission
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Check for librarian/admin permission
	const userRole = locals.user.role;
	if (userRole !== 'admin' && userRole !== 'librarian') {
		throw error(403, 'Insufficient permissions to manage library type');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const body = await request.json();
	const libraryType = body.libraryType as LibraryType;

	if (!libraryType || !['personal', 'public'].includes(libraryType)) {
		throw error(400, 'Invalid library type. Must be "personal" or "public"');
	}

	const audiobook = await setAudiobookLibraryType(audiobookId, libraryType);

	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	return json({
		success: true,
		libraryType: audiobook.libraryType
	});
};
