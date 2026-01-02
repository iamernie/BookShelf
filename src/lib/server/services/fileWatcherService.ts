import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import { existsSync } from 'fs';
import { addToQueue, getSettings } from './bookdropService';
import { createLogger } from './loggerService';

const log = createLogger('file-watcher');

// Supported ebook extensions
const SUPPORTED_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.cbr'];

// Active watchers by user ID (null = global)
const watchers = new Map<number | null, FSWatcher>();

// Debounce map to prevent duplicate events
const pendingFiles = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 2000; // Wait 2 seconds for file to finish copying

function isEbookFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return SUPPORTED_EXTENSIONS.includes(ext);
}

async function handleNewFile(filePath: string, userId: number | null): Promise<void> {
	const filename = path.basename(filePath);

	log.info(`New file detected: ${filename}`, { userId, filePath });

	try {
		// Verify file still exists (might have been moved/deleted)
		if (!existsSync(filePath)) {
			log.debug(`File no longer exists: ${filePath}`);
			return;
		}

		// Add to queue
		await addToQueue(filePath, filename, userId || undefined, 'watched_folder');

		log.info(`Added to queue: ${filename}`, { userId });

		// Check if auto-import is enabled
		const settings = await getSettings(userId || undefined);
		if (settings?.autoImport) {
			// Auto-import is handled elsewhere - could trigger import here
			log.info(`Auto-import is enabled for user ${userId}, file queued for processing`);
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('Duplicate')) {
			log.debug(`Duplicate file ignored: ${filename}`);
		} else {
			log.error(`Failed to process file: ${filename}`, { error });
		}
	}
}

function scheduleFileProcess(filePath: string, userId: number | null): void {
	// Cancel any pending timeout for this file
	const existing = pendingFiles.get(filePath);
	if (existing) {
		clearTimeout(existing);
	}

	// Schedule processing with debounce
	const timeout = setTimeout(() => {
		pendingFiles.delete(filePath);
		handleNewFile(filePath, userId);
	}, DEBOUNCE_MS);

	pendingFiles.set(filePath, timeout);
}

export async function startWatcher(
	folderPath: string,
	userId: number | null = null
): Promise<boolean> {
	// Stop existing watcher for this user if any
	await stopWatcher(userId);

	// Validate folder exists
	if (!existsSync(folderPath)) {
		log.error(`Watch folder does not exist: ${folderPath}`);
		return false;
	}

	log.info(`Starting file watcher for folder: ${folderPath}`, { userId });

	const watcher = chokidar.watch(folderPath, {
		ignored: [
			/(^|[\/\\])\../, // Ignore dotfiles
			/\.part$/, // Ignore partial downloads
			/\.tmp$/, // Ignore temp files
			/\.crdownload$/ // Ignore Chrome downloads in progress
		],
		persistent: true,
		ignoreInitial: false, // Process existing files
		awaitWriteFinish: {
			stabilityThreshold: 2000,
			pollInterval: 100
		},
		depth: 2 // Allow 2 levels of subdirectories
	});

	watcher.on('add', (filePath: string) => {
		if (isEbookFile(filePath)) {
			scheduleFileProcess(filePath, userId);
		}
	});

	watcher.on('error', (err: unknown) => {
		const error = err instanceof Error ? err : new Error(String(err));
		log.error(`Watcher error: ${error.message}`, { userId, folderPath });
	});

	watcher.on('ready', () => {
		log.info(`Watcher ready for: ${folderPath}`, { userId });
	});

	watchers.set(userId, watcher);
	return true;
}

export async function stopWatcher(userId: number | null = null): Promise<void> {
	const watcher = watchers.get(userId);
	if (watcher) {
		log.info(`Stopping file watcher`, { userId });
		await watcher.close();
		watchers.delete(userId);
	}
}

export async function stopAllWatchers(): Promise<void> {
	log.info(`Stopping all file watchers`);
	for (const [userId, watcher] of watchers) {
		await watcher.close();
	}
	watchers.clear();
}

export function isWatcherRunning(userId: number | null = null): boolean {
	return watchers.has(userId);
}

export function getActiveWatchers(): Array<{ userId: number | null }> {
	return Array.from(watchers.keys()).map((userId) => ({ userId }));
}

// Initialize watchers from database settings on startup
export async function initializeWatchers(): Promise<void> {
	log.info('Initializing file watchers from settings');

	try {
		// For now, just get global settings
		const settings = await getSettings();

		if (settings?.enabled && settings.folderPath) {
			await startWatcher(settings.folderPath, null);
		}
	} catch (error) {
		log.error('Failed to initialize watchers', { error });
	}
}
