import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings, saveSettings } from '$lib/server/services/bookdropService';
import {
	startWatcher,
	stopWatcher,
	isWatcherRunning
} from '$lib/server/services/fileWatcherService';

// GET /api/bookdrop/settings - Get BookDrop settings
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settings = await getSettings(locals.user.id);

	return json({
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
		watcherRunning: isWatcherRunning(locals.user.id) || isWatcherRunning(null)
	});
};

// PUT /api/bookdrop/settings - Update BookDrop settings
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const data = await request.json();

	const settings = await saveSettings(
		{
			folderPath: data.folderPath,
			enabled: data.enabled,
			autoImport: data.autoImport,
			afterImport: data.afterImport,
			processedFolder: data.processedFolder,
			afterSkip: data.afterSkip,
			skippedFolder: data.skippedFolder,
			defaultStatusId: data.defaultStatusId,
			defaultFormatId: data.defaultFormatId
		},
		locals.user.id
	);

	// Manage watcher based on settings
	if (settings.enabled && settings.folderPath) {
		await startWatcher(settings.folderPath, locals.user.id);
	} else {
		await stopWatcher(locals.user.id);
	}

	return json({
		success: true,
		settings,
		watcherRunning: isWatcherRunning(locals.user.id)
	});
};
