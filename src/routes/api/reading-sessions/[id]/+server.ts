/**
 * Reading Session API - Individual Session
 *
 * PATCH - End a reading session
 * DELETE - Delete a session
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { endSession } from '$lib/server/services/readingSessionService';
import { db } from '$lib/server/db';
import { readingSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const sessionId = parseInt(params.id);

	if (isNaN(sessionId)) {
		throw error(400, 'Invalid session ID');
	}

	const body = await request.json();
	const { endProgress, pagesRead } = body;

	await endSession(sessionId, endProgress, pagesRead);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const sessionId = parseInt(params.id);

	if (isNaN(sessionId)) {
		throw error(400, 'Invalid session ID');
	}

	await db.delete(readingSessions).where(eq(readingSessions.id, sessionId));

	return json({ success: true });
};
