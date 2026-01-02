import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getQueueItem,
	importQueueItem,
	skipQueueItem,
	deleteQueueItem,
	retryQueueItem,
	updateQueueItemMetadata
} from '$lib/server/services/bookdropService';

// GET /api/bookdrop/[id] - Get single queue item
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid ID');
	}

	const item = await getQueueItem(id);
	if (!item) {
		throw error(404, 'Item not found');
	}

	// Check ownership (admin can see all)
	if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	return json(item);
};

// PATCH /api/bookdrop/[id] - Update queue item metadata
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid ID');
	}

	const item = await getQueueItem(id);
	if (!item) {
		throw error(404, 'Item not found');
	}

	if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const data = await request.json();

	if (data.metadata) {
		await updateQueueItemMetadata(id, data.metadata);
	}

	const updated = await getQueueItem(id);
	return json(updated);
};

// POST /api/bookdrop/[id] - Perform action on queue item
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid ID');
	}

	const item = await getQueueItem(id);
	if (!item) {
		throw error(404, 'Item not found');
	}

	if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const data = await request.json();
	const action = data.action;

	switch (action) {
		case 'import': {
			const result = await importQueueItem(id, {
				title: data.title,
				authorName: data.authorName,
				statusId: data.statusId,
				formatId: data.formatId,
				genreId: data.genreId,
				libraryType: data.libraryType || 'public'
			});
			return json({ success: true, bookId: result.bookId });
		}

		case 'skip': {
			await skipQueueItem(id);
			return json({ success: true });
		}

		case 'retry': {
			await retryQueueItem(id);
			return json({ success: true });
		}

		default:
			throw error(400, `Unknown action: ${action}`);
	}
};

// DELETE /api/bookdrop/[id] - Delete queue item
export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid ID');
	}

	const item = await getQueueItem(id);
	if (!item) {
		throw error(404, 'Item not found');
	}

	if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const deleteFile = url.searchParams.get('deleteFile') !== 'false';
	await deleteQueueItem(id, deleteFile);

	return json({ success: true });
};
