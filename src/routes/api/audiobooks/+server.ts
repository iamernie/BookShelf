import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createAudiobook,
	getAudiobooks,
	type AudiobookListOptions
} from '$lib/server/services/audiobookService';

// GET /api/audiobooks - List audiobooks for current user
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const options: AudiobookListOptions = {
		userId: user.id,
		limit: parseInt(url.searchParams.get('limit') || '24'),
		offset: parseInt(url.searchParams.get('offset') || '0'),
		search: url.searchParams.get('search') || undefined,
		sortBy: (url.searchParams.get('sortBy') as AudiobookListOptions['sortBy']) || 'createdAt',
		sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
		filter: (url.searchParams.get('filter') as AudiobookListOptions['filter']) || 'all'
	};

	const result = await getAudiobooks(options);
	return json(result);
};

// POST /api/audiobooks - Create new audiobook (metadata only)
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();

		// Validate libraryType if provided
		const libraryType = body.libraryType;
		if (libraryType && !['personal', 'public'].includes(libraryType)) {
			throw error(400, 'Invalid library type. Must be "personal" or "public"');
		}

		// Only admin/librarian can create public audiobooks
		if (libraryType === 'public' && user.role !== 'admin' && user.role !== 'librarian') {
			throw error(403, 'Only admins and librarians can add to the public library');
		}

		const audiobook = await createAudiobook({
			title: body.title,
			userId: user.id,
			author: body.author || null,
			narratorName: body.narratorName || null,
			narratorId: body.narratorId || null,
			description: body.description || null,
			seriesName: body.seriesName || null,
			seriesNumber: body.seriesNumber || null,
			asin: body.asin || null,
			bookId: body.bookId || null,
			libraryType: libraryType || 'personal'
		});

		return json(audiobook, { status: 201 });
	} catch (e: any) {
		if (e.status) throw e;
		console.error('[api/audiobooks] Failed to create audiobook:', e);
		throw error(500, 'Failed to create audiobook');
	}
};
