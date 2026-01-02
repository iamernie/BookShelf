import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAudiobookById,
	getChapters,
	addChapter,
	updateChapter,
	deleteChapters,
	extractAndSaveChapters,
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

// GET /api/audiobooks/[id]/chapters - Get all chapters for an audiobook
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

	// Check access (owner, public, or in user library)
	if (!(await checkAudiobookAccess(audiobook, user.id))) {
		throw error(403, 'Access denied');
	}

	const chapters = await getChapters(audiobookId);

	return json({
		chapters,
		total: chapters.length
	});
};

// POST /api/audiobooks/[id]/chapters - Add a new chapter manually
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

	// Only owner can add chapters
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();

		// Validate required fields
		if (!body.title || typeof body.title !== 'string') {
			throw error(400, 'Chapter title is required');
		}

		if (typeof body.startTime !== 'number' || body.startTime < 0) {
			throw error(400, 'Valid start time is required');
		}

		// Get existing chapters to determine chapter number
		const existingChapters = await getChapters(audiobookId);
		const chapterNumber = existingChapters.length + 1;

		const chapter = await addChapter({
			audiobookId,
			title: body.title,
			startTime: body.startTime,
			endTime: body.endTime || null,
			chapterNumber
		});

		return json({ chapter }, { status: 201 });
	} catch (e: any) {
		if (e.status) throw e;
		console.error('[api/chapters] Failed to add chapter:', e);
		throw error(500, 'Failed to add chapter');
	}
};

// PUT /api/audiobooks/[id]/chapters - Update a chapter
export const PUT: RequestHandler = async ({ locals, params, request }) => {
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

	// Only owner can update chapters
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();

		if (!body.chapterId || typeof body.chapterId !== 'number') {
			throw error(400, 'Chapter ID is required');
		}

		const updateData: { title?: string; startTime?: number; endTime?: number } = {};

		if (body.title !== undefined) updateData.title = body.title;
		if (body.startTime !== undefined) updateData.startTime = body.startTime;
		if (body.endTime !== undefined) updateData.endTime = body.endTime;

		const chapter = await updateChapter(body.chapterId, updateData);

		if (!chapter) {
			throw error(404, 'Chapter not found');
		}

		return json({ chapter });
	} catch (e: any) {
		if (e.status) throw e;
		console.error('[api/chapters] Failed to update chapter:', e);
		throw error(500, 'Failed to update chapter');
	}
};

// DELETE /api/audiobooks/[id]/chapters - Delete all chapters or re-extract from file
export const DELETE: RequestHandler = async ({ locals, params, url }) => {
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

	// Only owner can delete chapters
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	const reextract = url.searchParams.get('reextract') === 'true';

	if (reextract) {
		// Re-extract chapters from audio files
		const chapters = await extractAndSaveChapters(audiobookId);
		return json({
			success: true,
			message: `Re-extracted ${chapters.length} chapter(s)`,
			chapters
		});
	} else {
		// Just delete all chapters
		await deleteChapters(audiobookId);
		return json({
			success: true,
			message: 'All chapters deleted'
		});
	}
};
