import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getQueueItems, getQueueStats, getSettings } from '$lib/server/services/bookdropService';
import { isWatcherRunning } from '$lib/server/services/fileWatcherService';
import { db, statuses, formats, genres } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const [pendingItems, importedItems, stats, settings, statusList, formatList, genreList] =
		await Promise.all([
			getQueueItems(locals.user.id, 'pending', 50),
			getQueueItems(locals.user.id, 'imported', 20),
			getQueueStats(locals.user.id),
			getSettings(locals.user.id),
			db.select().from(statuses).orderBy(asc(statuses.sortOrder)),
			db.select().from(formats).orderBy(asc(formats.name)),
			db.select().from(genres).orderBy(asc(genres.name))
		]);

	// Get failed/skipped items too
	const [failedItems, skippedItems] = await Promise.all([
		getQueueItems(locals.user.id, 'failed', 20),
		getQueueItems(locals.user.id, 'skipped', 20)
	]);

	return {
		pendingItems,
		importedItems,
		failedItems,
		skippedItems,
		stats,
		settings: settings || {
			folderPath: '',
			enabled: true,
			autoImport: false,
			afterImport: 'move',
			processedFolder: '',
			afterSkip: 'keep',
			skippedFolder: '',
			defaultStatusId: null,
			defaultFormatId: null
		},
		watcherRunning: isWatcherRunning(locals.user.id) || isWatcherRunning(null),
		statuses: statusList,
		formats: formatList,
		genres: genreList
	};
};
