import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAudiobookById,
	getOrCreateProgress,
	updateProgress,
	markAsFinished,
	resetProgress,
	isAudiobookInUserLibrary
} from '$lib/server/services/audiobookService';

// Helper to check audiobook access
async function checkAudiobookAccess(audiobook: Awaited<ReturnType<typeof getAudiobookById>>, userId: number): Promise<boolean> {
	if (!audiobook) return false;
	return (
		audiobook.userId === userId ||
		audiobook.libraryType === 'public' ||
		(await isAudiobookInUserLibrary(userId, audiobook.id))
	);
}

// GET /api/audiobooks/[id]/progress - Get current progress
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check access: user owns it, OR it's public, OR user has it in their library
	if (!(await checkAudiobookAccess(audiobook, user.id))) {
		throw error(403, 'Access denied');
	}

	const progress = await getOrCreateProgress(audiobookId, user.id);
	return json(progress);
};

// POST /api/audiobooks/[id]/progress - Update progress
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check access: user owns it, OR it's public, OR user has it in their library
	if (!(await checkAudiobookAccess(audiobook, user.id))) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();

		// Handle special actions
		if (body.action === 'finish') {
			const progress = await markAsFinished(audiobookId, user.id);
			return json(progress);
		}

		if (body.action === 'reset') {
			const progress = await resetProgress(audiobookId, user.id);
			return json(progress);
		}

		// Regular progress update
		const currentTime = parseFloat(body.currentTime);
		if (isNaN(currentTime)) {
			throw error(400, 'Invalid currentTime');
		}

		const progress = await updateProgress(
			audiobookId,
			user.id,
			currentTime,
			body.currentFileId ? parseInt(body.currentFileId) : undefined,
			body.playbackRate ? parseFloat(body.playbackRate) : undefined
		);

		return json(progress);
	} catch (e) {
		console.error('[api/audiobooks/progress] Failed to update progress:', e);
		throw error(500, 'Failed to update progress');
	}
};
