import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addBookmark, getBookmarks, deleteBookmark } from '$lib/server/services/audiobookService';

// GET /api/audiobooks/[id]/bookmarks - Get all bookmarks for an audiobook
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, { message: 'Invalid audiobook ID' });
	}

	try {
		// Get bookmarks for this user only (multi-user support)
		const bookmarks = await getBookmarks(audiobookId, locals.user.id);
		return json({ bookmarks });
	} catch (err) {
		console.error('[Bookmarks API] Error fetching bookmarks:', err);
		throw error(500, { message: 'Failed to fetch bookmarks' });
	}
};

// POST /api/audiobooks/[id]/bookmarks - Create a new bookmark
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, { message: 'Invalid audiobook ID' });
	}

	try {
		const data = await request.json();

		if (typeof data.time !== 'number' || data.time < 0) {
			throw error(400, { message: 'Invalid time value' });
		}

		const bookmark = await addBookmark({
			audiobookId,
			userId: locals.user.id,
			time: data.time,
			title: data.title || null,
			note: data.note || null
		});

		return json({ bookmark }, { status: 201 });
	} catch (err: any) {
		if (err.status) throw err;
		console.error('[Bookmarks API] Error creating bookmark:', err);
		throw error(500, { message: 'Failed to create bookmark' });
	}
};

// DELETE /api/audiobooks/[id]/bookmarks - Delete a bookmark
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	try {
		const data = await request.json();
		const bookmarkId = data.bookmarkId;

		if (!bookmarkId || typeof bookmarkId !== 'number') {
			throw error(400, { message: 'Invalid bookmark ID' });
		}

		// Delete bookmark (service validates user ownership)
		await deleteBookmark(bookmarkId, locals.user.id);
		return json({ success: true });
	} catch (err: any) {
		if (err.status) throw err;
		console.error('[Bookmarks API] Error deleting bookmark:', err);
		throw error(500, { message: 'Failed to delete bookmark' });
	}
};
