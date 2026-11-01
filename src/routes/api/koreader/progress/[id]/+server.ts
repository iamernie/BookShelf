/**
 * KOReader Progress Entry API
 *
 * DELETE /api/koreader/progress/[id] - Delete a progress entry entirely
 *
 * Use this to remove stale or incorrect sync entries
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { koreaderProgress } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { forgetManualHash } from '$lib/server/services/ebookHashService';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const progressId = parseInt(params.id);
	if (isNaN(progressId)) {
		throw error(400, 'Invalid progress ID');
	}

	// Verify the progress entry exists and belongs to this user
	const [progress] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.id, progressId),
				eq(koreaderProgress.userId, locals.user.id)
			)
		)
		.limit(1);

	if (!progress) {
		throw error(404, 'Progress entry not found');
	}

	// Delete the progress entry
	await db.delete(koreaderProgress).where(eq(koreaderProgress.id, progressId));

	// Otherwise the next push would create a new entry and redo a mistaken link
	if (progress.bookId) {
		await forgetManualHash(progress.bookId, progress.documentHash);
	}

	return json({ success: true, message: 'Progress entry deleted' });
};
