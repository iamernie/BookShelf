import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getAudiobookById, getBookmarks, getOrCreateProgress, isAudiobookInUserLibrary } from '$lib/server/services/audiobookService';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(id, user.id);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check access: user owns it, OR it's public, OR user has it in their library
	const hasAccess =
		audiobook.userId === user.id ||
		audiobook.libraryType === 'public' ||
		(await isAudiobookInUserLibrary(user.id, id));

	if (!hasAccess) {
		throw error(403, 'Access denied');
	}

	// If audiobook is linked to a book, redirect to the book's listen tab
	if (audiobook.bookId) {
		throw redirect(302, `/books/${audiobook.bookId}?listen=true`);
	}

	// Get or create progress
	const progress = await getOrCreateProgress(id, user.id);

	// Get bookmarks
	const bookmarks = await getBookmarks(id, user.id);

	return {
		audiobook,
		progress,
		bookmarks
	};
};
