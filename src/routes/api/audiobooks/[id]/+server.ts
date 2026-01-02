import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAudiobookById,
	updateAudiobook,
	deleteAudiobook
} from '$lib/server/services/audiobookService';

// GET /api/audiobooks/[id] - Get audiobook details
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(id, user.id);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check ownership (for now, only owner can access)
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	return json(audiobook);
};

// PATCH /api/audiobooks/[id] - Update audiobook
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(id);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check ownership
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();

		const updated = await updateAudiobook(id, {
			title: body.title,
			author: body.author,
			narratorName: body.narratorName,
			narratorId: body.narratorId,
			description: body.description,
			seriesName: body.seriesName,
			seriesNumber: body.seriesNumber,
			asin: body.asin,
			bookId: body.bookId
		});

		return json(updated);
	} catch (e) {
		console.error('[api/audiobooks] Failed to update audiobook:', e);
		throw error(500, 'Failed to update audiobook');
	}
};

// DELETE /api/audiobooks/[id] - Delete audiobook
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(id);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check ownership
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	await deleteAudiobook(id);
	return json({ success: true });
};
