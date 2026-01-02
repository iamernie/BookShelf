import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	importQueueItem,
	skipQueueItem,
	deleteQueueItem,
	getQueueItem,
	importAllPending
} from '$lib/server/services/bookdropService';

// POST /api/bookdrop/bulk - Perform bulk actions
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();
	const action = data.action;
	const ids: number[] = data.ids || [];

	const results: Array<{ id: number; success: boolean; error?: string; bookId?: number }> = [];

	switch (action) {
		case 'import': {
			for (const id of ids) {
				try {
					const item = await getQueueItem(id);
					if (!item) {
						results.push({ id, success: false, error: 'Item not found' });
						continue;
					}
					if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
						results.push({ id, success: false, error: 'Forbidden' });
						continue;
					}

					const result = await importQueueItem(id);
					results.push({ id, success: true, bookId: result.bookId });
				} catch (e) {
					results.push({
						id,
						success: false,
						error: e instanceof Error ? e.message : 'Unknown error'
					});
				}
			}
			break;
		}

		case 'import_all': {
			const result = await importAllPending(locals.user.id);
			return json({
				success: true,
				imported: result.success,
				failed: result.failed
			});
		}

		case 'skip': {
			for (const id of ids) {
				try {
					const item = await getQueueItem(id);
					if (!item) {
						results.push({ id, success: false, error: 'Item not found' });
						continue;
					}
					if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
						results.push({ id, success: false, error: 'Forbidden' });
						continue;
					}

					await skipQueueItem(id);
					results.push({ id, success: true });
				} catch (e) {
					results.push({
						id,
						success: false,
						error: e instanceof Error ? e.message : 'Unknown error'
					});
				}
			}
			break;
		}

		case 'delete': {
			const deleteFiles = data.deleteFiles !== false;

			for (const id of ids) {
				try {
					const item = await getQueueItem(id);
					if (!item) {
						results.push({ id, success: false, error: 'Item not found' });
						continue;
					}
					if (item.userId !== locals.user.id && locals.user.role !== 'admin') {
						results.push({ id, success: false, error: 'Forbidden' });
						continue;
					}

					await deleteQueueItem(id, deleteFiles);
					results.push({ id, success: true });
				} catch (e) {
					results.push({
						id,
						success: false,
						error: e instanceof Error ? e.message : 'Unknown error'
					});
				}
			}
			break;
		}

		default:
			throw error(400, `Unknown action: ${action}`);
	}

	const successCount = results.filter((r) => r.success).length;
	const failedCount = results.filter((r) => !r.success).length;

	return json({
		success: failedCount === 0,
		message: `${action}: ${successCount} succeeded, ${failedCount} failed`,
		results
	});
};
