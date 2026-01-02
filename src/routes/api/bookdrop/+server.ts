import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getQueueItems,
	getQueueStats,
	getSettings,
	saveSettings,
	clearQueue
} from '$lib/server/services/bookdropService';
import {
	startWatcher,
	stopWatcher,
	isWatcherRunning
} from '$lib/server/services/fileWatcherService';

// GET /api/bookdrop - Get queue items and stats
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const status = url.searchParams.get('status') || undefined;
	const limit = parseInt(url.searchParams.get('limit') || '100', 10);

	const [items, stats, settings] = await Promise.all([
		getQueueItems(locals.user.id, status, limit),
		getQueueStats(locals.user.id),
		getSettings(locals.user.id)
	]);

	return json({
		items,
		stats,
		settings,
		watcherRunning: isWatcherRunning(locals.user.id) || isWatcherRunning(null)
	});
};

// DELETE /api/bookdrop - Clear queue items
export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const status = url.searchParams.get('status') as 'imported' | 'skipped' | 'failed' | undefined;

	const count = await clearQueue(locals.user.id, status);

	return json({ success: true, cleared: count });
};
