import { db } from '$lib/server/db';
import {
	audiobooks,
	audiobookFiles,
	audiobookProgress,
	audiobookChapters,
	audiobookBookmarks,
	userAudiobooks,
	userBooks,
	statuses,
	type Audiobook,
	type NewAudiobook,
	type AudiobookFile,
	type NewAudiobookFile,
	type AudiobookProgress,
	type NewAudiobookProgress,
	type AudiobookChapter,
	type NewAudiobookChapter,
	type AudiobookBookmark,
	type NewAudiobookBookmark,
	type UserAudiobook,
	type NewUserAudiobook
} from '$lib/server/db/schema';
import { eq, and, desc, asc, sql, or } from 'drizzle-orm';
import { parseFile } from 'music-metadata';
import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { env } from '$env/dynamic/private';
import { getSetting } from './settingsService';

// ============================================================================
// Types
// ============================================================================

export interface AudiobookWithFiles extends Audiobook {
	files: AudiobookFile[];
	chapters?: AudiobookChapter[];
	userProgress?: AudiobookProgress | null;
}

export interface AudiobookListOptions {
	userId: number;
	limit?: number;
	offset?: number;
	search?: string;
	sortBy?: 'title' | 'author' | 'createdAt' | 'duration' | 'lastPlayed';
	sortOrder?: 'asc' | 'desc';
	filter?: 'all' | 'in_progress' | 'completed' | 'not_started';
}

export interface AudiobookListResult {
	items: AudiobookWithFiles[];
	total: number;
	limit: number;
	offset: number;
}

// ============================================================================
// File Storage Configuration
// ============================================================================

// Cache for the audiobooks path to avoid repeated async calls
let _audiobooksPathCache: string | null = null;

async function getAudiobooksBasePathAsync(): Promise<string> {
	if (_audiobooksPathCache) {
		return _audiobooksPathCache;
	}
	const path = await getSetting('storage.audiobooks_path');
	_audiobooksPathCache = path;
	return path;
}

// Synchronous version for cases where we can't use async
function getAudiobooksBasePath(): string {
	// If we have a cached value, use it
	if (_audiobooksPathCache) {
		return _audiobooksPathCache;
	}
	// Fall back to default - the async version will update the cache
	const dataPath = env.DATA_PATH || './data';
	return join(dataPath, 'audiobooks');
}

// Clear cache when settings might have changed
export function clearAudiobooksPathCache(): void {
	_audiobooksPathCache = null;
}

function getAudiobookPath(userId: number, audiobookId: number): string {
	return join(getAudiobooksBasePath(), String(userId), String(audiobookId));
}

function ensureAudiobookDir(userId: number, audiobookId: number): string {
	const dir = getAudiobookPath(userId, audiobookId);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

// ============================================================================
// MIME Type Helpers
// ============================================================================

const SUPPORTED_AUDIO_TYPES: Record<string, string> = {
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.m4b': 'audio/mp4',
	'.aac': 'audio/aac',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/opus',
	'.flac': 'audio/flac',
	'.wav': 'audio/wav'
};

export function getMimeType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	return SUPPORTED_AUDIO_TYPES[ext] || 'audio/mpeg';
}

export function isSupportedAudioFormat(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	return ext in SUPPORTED_AUDIO_TYPES;
}

// Browser-playable formats (no transcoding needed)
const BROWSER_PLAYABLE = ['.mp3', '.m4a', '.m4b', '.aac', '.ogg', '.opus', '.wav'];

export function isBrowserPlayable(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	return BROWSER_PLAYABLE.includes(ext);
}

// ============================================================================
// Audio Metadata Extraction
// ============================================================================

export interface AudioChapter {
	title: string;
	startTime: number; // seconds
	endTime?: number; // seconds
}

export interface AudioMetadata {
	duration: number; // seconds
	title?: string;
	artist?: string;
	album?: string;
	track?: number;
	chapters?: AudioChapter[];
}

// Timeout for metadata extraction (30 seconds)
const METADATA_EXTRACTION_TIMEOUT_MS = 30000;

export async function extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
	try {
		console.log(`[audiobookService] Extracting metadata from: ${filePath}`);

		// Parse with timeout to prevent hanging on large files
		const metadata = await Promise.race([
			parseFile(filePath),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Metadata extraction timeout')), METADATA_EXTRACTION_TIMEOUT_MS)
			)
		]);

		console.log(`[audiobookService] Metadata extracted, duration: ${metadata.format.duration}s`);
		const parsedChapters: AudioChapter[] = [];
		const duration = metadata.format.duration || 0;

		// Try to extract chapters from various formats
		if (metadata.native) {
			// 1. M4B/M4A format - iTunes chapter list (chpl)
			const iTunesTags = metadata.native['iTunes'];
			if (iTunesTags) {
				for (const tag of iTunesTags) {
					if (tag.id === 'chpl') {
						// chpl contains an array of chapter entries
						const chapterList = tag.value as Array<{ title: string; startTimeMs: number }>;
						if (Array.isArray(chapterList)) {
							for (let i = 0; i < chapterList.length; i++) {
								const chapter = chapterList[i];
								const startTime = chapter.startTimeMs / 1000; // Convert ms to seconds
								const endTime = i < chapterList.length - 1
									? chapterList[i + 1].startTimeMs / 1000
									: duration;

								parsedChapters.push({
									title: chapter.title || `Chapter ${i + 1}`,
									startTime,
									endTime
								});
							}
						}
					}
				}
			}

			// 2. ID3v2 CHAP tag (used in MP3 files)
			if (parsedChapters.length === 0) {
				for (const format of Object.values(metadata.native)) {
					for (const tag of format) {
						if (tag.id === 'CHAP') {
							const chapterData = tag.value as {
								startTime?: number;
								endTime?: number;
								tags?: { title?: string }
							};
							if (chapterData && typeof chapterData.startTime === 'number') {
								parsedChapters.push({
									title: chapterData.tags?.title || `Chapter ${parsedChapters.length + 1}`,
									startTime: chapterData.startTime / 1000, // Convert ms to seconds
									endTime: chapterData.endTime ? chapterData.endTime / 1000 : undefined
								});
							}
						}
					}
				}
			}
		}

		// Sort chapters by start time
		parsedChapters.sort((a, b) => a.startTime - b.startTime);

		// Fill in missing end times
		for (let i = 0; i < parsedChapters.length; i++) {
			if (!parsedChapters[i].endTime) {
				parsedChapters[i].endTime = i < parsedChapters.length - 1
					? parsedChapters[i + 1].startTime
					: duration;
			}
		}

		return {
			duration,
			title: metadata.common.title,
			artist: metadata.common.artist || metadata.common.albumartist,
			album: metadata.common.album,
			track: metadata.common.track?.no ?? undefined,
			chapters: parsedChapters.length > 0 ? parsedChapters : undefined
		};
	} catch (error) {
		console.error('[audiobookService] Failed to extract metadata:', error);
		return { duration: 0 };
	}
}

// ============================================================================
// Audiobook CRUD
// ============================================================================

export async function createAudiobook(data: NewAudiobook): Promise<Audiobook> {
	const now = new Date().toISOString();
	const [audiobook] = await db.insert(audiobooks).values({
		...data,
		createdAt: now,
		updatedAt: now
	}).returning();

	return audiobook;
}

export async function getAudiobookById(id: number, userId?: number): Promise<AudiobookWithFiles | null> {
	const results = await db.query.audiobooks.findFirst({
		where: eq(audiobooks.id, id),
		with: {
			files: {
				orderBy: [asc(audiobookFiles.trackNumber)]
			},
			chapters: {
				orderBy: [asc(audiobookChapters.chapterNumber)]
			}
		}
	});

	if (!results) return null;

	// Get user progress if userId provided
	let userProgress: AudiobookProgress | null = null;
	if (userId) {
		const progress = await db.query.audiobookProgress.findFirst({
			where: and(
				eq(audiobookProgress.audiobookId, id),
				eq(audiobookProgress.userId, userId)
			)
		});
		userProgress = progress || null;
	}

	return {
		...results,
		userProgress
	};
}

export async function getAudiobooks(options: AudiobookListOptions): Promise<AudiobookListResult> {
	const {
		userId,
		limit = 24,
		offset = 0,
		search,
		sortBy = 'createdAt',
		sortOrder = 'desc',
		filter = 'all'
	} = options;

	// Build conditions
	const conditions = [eq(audiobooks.userId, userId)];

	// Get all audiobooks for the user
	let query = db.query.audiobooks.findMany({
		where: and(...conditions),
		with: {
			files: {
				orderBy: [asc(audiobookFiles.trackNumber)]
			}
		},
		orderBy: sortBy === 'title'
			? (sortOrder === 'asc' ? [asc(audiobooks.title)] : [desc(audiobooks.title)])
			: sortBy === 'author'
			? (sortOrder === 'asc' ? [asc(audiobooks.author)] : [desc(audiobooks.author)])
			: sortBy === 'duration'
			? (sortOrder === 'asc' ? [asc(audiobooks.duration)] : [desc(audiobooks.duration)])
			: (sortOrder === 'asc' ? [asc(audiobooks.createdAt)] : [desc(audiobooks.createdAt)]),
		limit,
		offset
	});

	const items = await query;

	// Get progress for each audiobook
	const progressMap = new Map<number, AudiobookProgress>();
	if (items.length > 0) {
		const progressRecords = await db.query.audiobookProgress.findMany({
			where: and(
				eq(audiobookProgress.userId, userId),
				sql`${audiobookProgress.audiobookId} IN (${sql.join(items.map(a => sql`${a.id}`), sql`, `)})`
			)
		});

		for (const p of progressRecords) {
			progressMap.set(p.audiobookId, p);
		}
	}

	// Apply progress to items and filter
	let enrichedItems: AudiobookWithFiles[] = items.map(item => ({
		...item,
		userProgress: progressMap.get(item.id) || null
	}));

	// Apply filter
	if (filter === 'in_progress') {
		enrichedItems = enrichedItems.filter(item =>
			item.userProgress &&
			(item.userProgress.progress ?? 0) > 0 &&
			!item.userProgress.isFinished
		);
	} else if (filter === 'completed') {
		enrichedItems = enrichedItems.filter(item =>
			item.userProgress?.isFinished
		);
	} else if (filter === 'not_started') {
		enrichedItems = enrichedItems.filter(item =>
			!item.userProgress || (item.userProgress.progress ?? 0) === 0
		);
	}

	// Apply search filter (client-side for now)
	if (search) {
		const searchLower = search.toLowerCase();
		enrichedItems = enrichedItems.filter(item =>
			item.title.toLowerCase().includes(searchLower) ||
			item.author?.toLowerCase().includes(searchLower) ||
			item.narratorName?.toLowerCase().includes(searchLower)
		);
	}

	// Get total count
	const totalResult = await db.select({ count: sql<number>`count(*)` })
		.from(audiobooks)
		.where(eq(audiobooks.userId, userId));
	const total = totalResult[0]?.count || 0;

	return {
		items: enrichedItems,
		total,
		limit,
		offset
	};
}

export async function updateAudiobook(id: number, data: Partial<Audiobook>): Promise<Audiobook | null> {
	const now = new Date().toISOString();
	const [updated] = await db.update(audiobooks)
		.set({ ...data, updatedAt: now })
		.where(eq(audiobooks.id, id))
		.returning();

	return updated || null;
}

/**
 * Get all audiobooks linked to a specific book
 */
export async function getAudiobooksByBookId(bookId: number, userId?: number): Promise<AudiobookWithFiles[]> {
	const results = await db.query.audiobooks.findMany({
		where: eq(audiobooks.bookId, bookId),
		with: {
			files: {
				orderBy: [asc(audiobookFiles.trackNumber)]
			},
			chapters: {
				orderBy: [asc(audiobookChapters.chapterNumber)]
			}
		},
		orderBy: [desc(audiobooks.createdAt)]
	});

	// Add progress for the specified user
	if (userId && results.length > 0) {
		const progressRecords = await db.query.audiobookProgress.findMany({
			where: and(
				eq(audiobookProgress.userId, userId),
				sql`${audiobookProgress.audiobookId} IN (${sql.join(results.map(a => sql`${a.id}`), sql`, `)})`
			)
		});

		const progressMap = new Map<number, AudiobookProgress>();
		for (const p of progressRecords) {
			progressMap.set(p.audiobookId, p);
		}

		return results.map(item => ({
			...item,
			userProgress: progressMap.get(item.id) || null
		}));
	}

	return results.map(item => ({ ...item, userProgress: null }));
}

export async function deleteAudiobook(id: number): Promise<boolean> {
	// Get audiobook to find files to delete
	const audiobook = await getAudiobookById(id);
	if (!audiobook) return false;

	// Delete physical files
	for (const file of audiobook.files) {
		try {
			if (existsSync(file.filePath)) {
				unlinkSync(file.filePath);
			}
		} catch (e) {
			console.error('[audiobookService] Failed to delete file:', file.filePath, e);
		}
	}

	// Delete cover if exists
	if (audiobook.coverPath && existsSync(audiobook.coverPath)) {
		try {
			unlinkSync(audiobook.coverPath);
		} catch (e) {
			console.error('[audiobookService] Failed to delete cover:', audiobook.coverPath, e);
		}
	}

	// Delete from database (cascade will handle files, progress, chapters, bookmarks)
	await db.delete(audiobooks).where(eq(audiobooks.id, id));

	return true;
}

// ============================================================================
// Audiobook Files
// ============================================================================

export async function addAudiobookFile(data: NewAudiobookFile): Promise<AudiobookFile> {
	const now = new Date().toISOString();
	const [file] = await db.insert(audiobookFiles).values({
		...data,
		createdAt: now,
		updatedAt: now
	}).returning();

	// Update audiobook total duration
	await recalculateAudiobookDuration(data.audiobookId);

	return file;
}

export async function recalculateAudiobookDuration(audiobookId: number): Promise<number> {
	// Get all files and calculate total duration
	const files = await db.query.audiobookFiles.findMany({
		where: eq(audiobookFiles.audiobookId, audiobookId),
		orderBy: [asc(audiobookFiles.trackNumber)]
	});

	let totalDuration = 0;
	let currentOffset = 0;

	// Update startOffset for each file
	for (const file of files) {
		await db.update(audiobookFiles)
			.set({ startOffset: currentOffset })
			.where(eq(audiobookFiles.id, file.id));

		currentOffset += file.duration;
		totalDuration += file.duration;
	}

	// Update audiobook duration
	await db.update(audiobooks)
		.set({ duration: totalDuration, updatedAt: new Date().toISOString() })
		.where(eq(audiobooks.id, audiobookId));

	return totalDuration;
}

export async function getAudiobookFileById(id: number): Promise<AudiobookFile | null> {
	const file = await db.query.audiobookFiles.findFirst({
		where: eq(audiobookFiles.id, id)
	});
	return file || null;
}

export async function deleteAudiobookFile(id: number): Promise<boolean> {
	const file = await getAudiobookFileById(id);
	if (!file) return false;

	// Delete physical file
	try {
		if (existsSync(file.filePath)) {
			unlinkSync(file.filePath);
		}
	} catch (e) {
		console.error('[audiobookService] Failed to delete file:', file.filePath, e);
	}

	// Delete from database
	await db.delete(audiobookFiles).where(eq(audiobookFiles.id, id));

	// Recalculate duration
	await recalculateAudiobookDuration(file.audiobookId);

	return true;
}

// ============================================================================
// Progress Tracking
// ============================================================================

export async function getOrCreateProgress(audiobookId: number, userId: number): Promise<AudiobookProgress> {
	// Try to get existing progress
	let progress = await db.query.audiobookProgress.findFirst({
		where: and(
			eq(audiobookProgress.audiobookId, audiobookId),
			eq(audiobookProgress.userId, userId)
		)
	});

	if (progress) return progress;

	// Get audiobook duration
	const audiobook = await db.query.audiobooks.findFirst({
		where: eq(audiobooks.id, audiobookId)
	});

	// Create new progress record
	const now = new Date().toISOString();
	const [newProgress] = await db.insert(audiobookProgress).values({
		audiobookId,
		userId,
		currentTime: 0,
		duration: audiobook?.duration || 0,
		progress: 0,
		playbackRate: 1,
		isFinished: false,
		createdAt: now,
		updatedAt: now
	}).returning();

	return newProgress;
}

/**
 * Sync audiobook completion to userAudiobooks status and linked book's user_books status
 * Called when audiobook reaches 95%+ progress or is manually marked as finished
 */
async function syncAudiobookCompletionStatus(audiobookId: number, userId: number): Promise<void> {
	const now = new Date().toISOString();

	// Get the READ status
	const readStatus = await db.query.statuses.findFirst({
		where: eq(statuses.key, 'READ')
	});

	if (!readStatus) return;

	// Update userAudiobooks status if user has this audiobook in their library
	const userAudiobook = await db.query.userAudiobooks.findFirst({
		where: and(
			eq(userAudiobooks.audiobookId, audiobookId),
			eq(userAudiobooks.userId, userId)
		)
	});

	if (userAudiobook && userAudiobook.statusId !== readStatus.id) {
		await db.update(userAudiobooks)
			.set({ statusId: readStatus.id, updatedAt: now })
			.where(eq(userAudiobooks.id, userAudiobook.id));
	}

	// Get the audiobook to check if it's linked to a book
	const audiobook = await db.query.audiobooks.findFirst({
		where: eq(audiobooks.id, audiobookId)
	});

	if (audiobook?.bookId) {
		// Update the linked book's status in user_books
		const userBook = await db.query.userBooks.findFirst({
			where: and(
				eq(userBooks.bookId, audiobook.bookId),
				eq(userBooks.userId, userId)
			)
		});

		if (userBook && userBook.statusId !== readStatus.id) {
			await db.update(userBooks)
				.set({
					statusId: readStatus.id,
					completedDate: now.split('T')[0], // Just the date part
					updatedAt: now
				})
				.where(eq(userBooks.id, userBook.id));
		}
	}
}

export async function updateProgress(
	audiobookId: number,
	userId: number,
	currentTime: number,
	currentFileId?: number,
	playbackRate?: number
): Promise<AudiobookProgress> {
	const now = new Date().toISOString();

	// Get or create progress
	let progress = await getOrCreateProgress(audiobookId, userId);

	// Get audiobook duration
	const audiobook = await db.query.audiobooks.findFirst({
		where: eq(audiobooks.id, audiobookId)
	});
	const duration = audiobook?.duration || 1;

	// Calculate progress percentage
	const progressPercent = Math.min(currentTime / duration, 1);

	// Check if finished (>= 95% or within last 30 seconds)
	const isFinished = progressPercent >= 0.95 || (duration - currentTime) <= 30;

	// Update progress
	const updateData: Partial<AudiobookProgress> = {
		currentTime,
		progress: progressPercent,
		lastPlayedAt: now,
		updatedAt: now
	};

	if (currentFileId !== undefined) {
		updateData.currentFileId = currentFileId;
	}

	if (playbackRate !== undefined) {
		updateData.playbackRate = playbackRate;
	}

	// Track if this is a new completion
	const newlyFinished = isFinished && !progress.isFinished;

	if (newlyFinished) {
		updateData.isFinished = true;
		updateData.finishedAt = now;
	}

	const [updated] = await db.update(audiobookProgress)
		.set(updateData)
		.where(eq(audiobookProgress.id, progress.id))
		.returning();

	// Sync read status to userAudiobooks and linked book when newly finished
	if (newlyFinished) {
		await syncAudiobookCompletionStatus(audiobookId, userId);
	}

	return updated;
}

export async function markAsFinished(audiobookId: number, userId: number): Promise<AudiobookProgress> {
	const now = new Date().toISOString();
	let progress = await getOrCreateProgress(audiobookId, userId);

	const [updated] = await db.update(audiobookProgress)
		.set({
			isFinished: true,
			finishedAt: now,
			progress: 1,
			updatedAt: now
		})
		.where(eq(audiobookProgress.id, progress.id))
		.returning();

	// Sync read status to userAudiobooks and linked book
	await syncAudiobookCompletionStatus(audiobookId, userId);

	return updated;
}

export async function resetProgress(audiobookId: number, userId: number): Promise<AudiobookProgress> {
	const now = new Date().toISOString();
	let progress = await getOrCreateProgress(audiobookId, userId);

	const [updated] = await db.update(audiobookProgress)
		.set({
			currentTime: 0,
			currentFileId: null,
			progress: 0,
			isFinished: false,
			finishedAt: null,
			updatedAt: now
		})
		.where(eq(audiobookProgress.id, progress.id))
		.returning();

	return updated;
}

// ============================================================================
// Chapters
// ============================================================================

export async function addChapter(data: NewAudiobookChapter): Promise<AudiobookChapter> {
	const now = new Date().toISOString();
	const [chapter] = await db.insert(audiobookChapters).values({
		...data,
		createdAt: now,
		updatedAt: now
	}).returning();

	return chapter;
}

export async function addChapters(audiobookId: number, chapters: AudioChapter[]): Promise<AudiobookChapter[]> {
	if (chapters.length === 0) return [];

	const now = new Date().toISOString();
	const chapterData = chapters.map((ch, index) => ({
		audiobookId,
		title: ch.title,
		startTime: ch.startTime,
		endTime: ch.endTime || null,
		chapterNumber: index + 1,
		createdAt: now,
		updatedAt: now
	}));

	const inserted = await db.insert(audiobookChapters).values(chapterData).returning();
	return inserted;
}

export async function getChapters(audiobookId: number): Promise<AudiobookChapter[]> {
	return db.query.audiobookChapters.findMany({
		where: eq(audiobookChapters.audiobookId, audiobookId),
		orderBy: [asc(audiobookChapters.chapterNumber)]
	});
}

export async function deleteChapters(audiobookId: number): Promise<void> {
	await db.delete(audiobookChapters).where(eq(audiobookChapters.audiobookId, audiobookId));
}

/**
 * Extract chapters from audio files and save to database.
 * For M4B files, extracts embedded chapter markers.
 * For multi-file audiobooks, creates chapters from track titles.
 */
export async function extractAndSaveChapters(audiobookId: number): Promise<AudiobookChapter[]> {
	// First, clear any existing chapters
	await deleteChapters(audiobookId);

	// Get audiobook with files
	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook || !audiobook.files || audiobook.files.length === 0) {
		return [];
	}

	const chapters: AudioChapter[] = [];

	// If single file (likely M4B), try to extract embedded chapters
	if (audiobook.files.length === 1) {
		const file = audiobook.files[0];
		try {
			const metadata = await extractAudioMetadata(file.filePath);
			if (metadata.chapters && metadata.chapters.length > 0) {
				// Found embedded chapters in M4B file
				return addChapters(audiobookId, metadata.chapters);
			}
		} catch (e) {
			console.error('[audiobookService] Failed to extract chapters from file:', e);
		}
	}

	// For multi-file audiobooks or single files without embedded chapters,
	// create chapters from track titles
	for (const file of audiobook.files) {
		const startOffset = file.startOffset ?? 0;
		chapters.push({
			title: file.title || `Track ${file.trackNumber}`,
			startTime: startOffset,
			endTime: startOffset + file.duration
		});
	}

	if (chapters.length > 0) {
		return addChapters(audiobookId, chapters);
	}

	return [];
}

/**
 * Update a single chapter
 */
export async function updateChapter(
	chapterId: number,
	data: { title?: string; startTime?: number; endTime?: number }
): Promise<AudiobookChapter | null> {
	const now = new Date().toISOString();
	const [updated] = await db.update(audiobookChapters)
		.set({ ...data, updatedAt: now })
		.where(eq(audiobookChapters.id, chapterId))
		.returning();

	return updated || null;
}

/**
 * Get chapter at a specific time position
 */
export function getCurrentChapter(chapters: AudiobookChapter[], currentTime: number): AudiobookChapter | null {
	for (let i = chapters.length - 1; i >= 0; i--) {
		if (currentTime >= chapters[i].startTime) {
			return chapters[i];
		}
	}
	return chapters[0] || null;
}

// ============================================================================
// Bookmarks
// ============================================================================

export async function addBookmark(data: NewAudiobookBookmark): Promise<AudiobookBookmark> {
	const now = new Date().toISOString();
	const [bookmark] = await db.insert(audiobookBookmarks).values({
		...data,
		createdAt: now
	}).returning();

	return bookmark;
}

export async function getBookmarks(audiobookId: number, userId: number): Promise<AudiobookBookmark[]> {
	return db.query.audiobookBookmarks.findMany({
		where: and(
			eq(audiobookBookmarks.audiobookId, audiobookId),
			eq(audiobookBookmarks.userId, userId)
		),
		orderBy: [asc(audiobookBookmarks.time)]
	});
}

export async function deleteBookmark(id: number, userId: number): Promise<boolean> {
	const result = await db.delete(audiobookBookmarks)
		.where(and(
			eq(audiobookBookmarks.id, id),
			eq(audiobookBookmarks.userId, userId)
		));

	return true;
}

// ============================================================================
// Recently Played
// ============================================================================

export async function getRecentlyPlayed(userId: number, limit: number = 10): Promise<AudiobookWithFiles[]> {
	const recentProgress = await db.query.audiobookProgress.findMany({
		where: and(
			eq(audiobookProgress.userId, userId),
			sql`${audiobookProgress.lastPlayedAt} IS NOT NULL`
		),
		orderBy: [desc(audiobookProgress.lastPlayedAt)],
		limit
	});

	const audiobookIds = recentProgress.map(p => p.audiobookId);
	if (audiobookIds.length === 0) return [];

	const items: AudiobookWithFiles[] = [];
	for (const id of audiobookIds) {
		const audiobook = await getAudiobookById(id, userId);
		if (audiobook) {
			items.push(audiobook);
		}
	}

	return items;
}

// ============================================================================
// Continue Listening (in progress)
// ============================================================================

export async function getContinueListening(userId: number, limit: number = 10): Promise<AudiobookWithFiles[]> {
	const inProgress = await db.query.audiobookProgress.findMany({
		where: and(
			eq(audiobookProgress.userId, userId),
			sql`${audiobookProgress.progress} > 0`,
			eq(audiobookProgress.isFinished, false)
		),
		orderBy: [desc(audiobookProgress.lastPlayedAt)],
		limit
	});

	const items: AudiobookWithFiles[] = [];
	for (const progress of inProgress) {
		const audiobook = await getAudiobookById(progress.audiobookId, userId);
		if (audiobook) {
			items.push(audiobook);
		}
	}

	return items;
}

// ============================================================================
// Helper: Format Duration
// ============================================================================

export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m ${secs}s`;
}

export function formatDurationLong(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours} hr ${minutes} min`;
	}
	return `${minutes} min`;
}

// ============================================================================
// User Audiobook Library (Public Library Feature)
// ============================================================================

/**
 * Add an audiobook to a user's personal library
 */
export async function addAudiobookToUserLibrary(
	userId: number,
	audiobookId: number,
	data?: { statusId?: number; rating?: number; comments?: string }
): Promise<UserAudiobook> {
	const now = new Date().toISOString();

	// Check if already in library
	const existing = await db.query.userAudiobooks.findFirst({
		where: and(
			eq(userAudiobooks.userId, userId),
			eq(userAudiobooks.audiobookId, audiobookId)
		)
	});

	if (existing) {
		// Update existing entry
		const [updated] = await db.update(userAudiobooks)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(userAudiobooks.id, existing.id))
			.returning();
		return updated;
	}

	// Create new entry
	const [entry] = await db.insert(userAudiobooks).values({
		userId,
		audiobookId,
		statusId: data?.statusId ?? null,
		rating: data?.rating ?? null,
		comments: data?.comments ?? null,
		addedAt: now,
		createdAt: now,
		updatedAt: now
	}).returning();

	return entry;
}

/**
 * Remove an audiobook from a user's personal library
 */
export async function removeAudiobookFromUserLibrary(userId: number, audiobookId: number): Promise<boolean> {
	const result = await db.delete(userAudiobooks)
		.where(and(
			eq(userAudiobooks.userId, userId),
			eq(userAudiobooks.audiobookId, audiobookId)
		));

	return true;
}

/**
 * Check if an audiobook is in a user's library
 */
export async function isAudiobookInUserLibrary(userId: number, audiobookId: number): Promise<boolean> {
	const entry = await db.query.userAudiobooks.findFirst({
		where: and(
			eq(userAudiobooks.userId, userId),
			eq(userAudiobooks.audiobookId, audiobookId)
		)
	});
	return !!entry;
}

/**
 * Get a user's library entry for an audiobook
 */
export async function getUserAudiobookEntry(userId: number, audiobookId: number): Promise<UserAudiobook | null> {
	const entry = await db.query.userAudiobooks.findFirst({
		where: and(
			eq(userAudiobooks.userId, userId),
			eq(userAudiobooks.audiobookId, audiobookId)
		)
	});
	return entry || null;
}

/**
 * Update a user's audiobook library entry
 */
export async function updateUserAudiobookEntry(
	userId: number,
	audiobookId: number,
	data: { statusId?: number | null; rating?: number | null; comments?: string | null }
): Promise<UserAudiobook | null> {
	const now = new Date().toISOString();

	const [updated] = await db.update(userAudiobooks)
		.set({
			...data,
			updatedAt: now
		})
		.where(and(
			eq(userAudiobooks.userId, userId),
			eq(userAudiobooks.audiobookId, audiobookId)
		))
		.returning();

	return updated || null;
}

/**
 * Get audiobooks visible to a user (public or owned by user or in user's library)
 */
export async function getAudiobooksForUser(options: AudiobookListOptions & { libraryFilter?: 'all' | 'public' | 'personal' }): Promise<AudiobookListResult> {
	const {
		userId,
		limit = 24,
		offset = 0,
		search,
		sortBy = 'createdAt',
		sortOrder = 'desc',
		filter = 'all',
		libraryFilter = 'all'
	} = options;

	// Build base conditions based on library filter
	let whereCondition;

	if (libraryFilter === 'public') {
		// Only public audiobooks
		whereCondition = eq(audiobooks.libraryType, 'public');
	} else if (libraryFilter === 'personal') {
		// Audiobooks in user's personal library (via user_audiobooks) OR owned by user
		whereCondition = or(
			eq(audiobooks.userId, userId),
			sql`${audiobooks.id} IN (SELECT audiobookId FROM user_audiobooks WHERE userId = ${userId})`
		);
	} else {
		// All audiobooks user can access: public OR owned by user OR in user's library
		whereCondition = or(
			eq(audiobooks.libraryType, 'public'),
			eq(audiobooks.userId, userId),
			sql`${audiobooks.id} IN (SELECT audiobookId FROM user_audiobooks WHERE userId = ${userId})`
		);
	}

	// Get audiobooks
	const items = await db.query.audiobooks.findMany({
		where: whereCondition,
		with: {
			files: {
				orderBy: [asc(audiobookFiles.trackNumber)]
			}
		},
		orderBy: sortBy === 'title'
			? (sortOrder === 'asc' ? [asc(audiobooks.title)] : [desc(audiobooks.title)])
			: sortBy === 'author'
			? (sortOrder === 'asc' ? [asc(audiobooks.author)] : [desc(audiobooks.author)])
			: sortBy === 'duration'
			? (sortOrder === 'asc' ? [asc(audiobooks.duration)] : [desc(audiobooks.duration)])
			: (sortOrder === 'asc' ? [asc(audiobooks.createdAt)] : [desc(audiobooks.createdAt)]),
		limit,
		offset
	});

	// Get progress for each audiobook
	const progressMap = new Map<number, AudiobookProgress>();
	if (items.length > 0) {
		const progressRecords = await db.query.audiobookProgress.findMany({
			where: and(
				eq(audiobookProgress.userId, userId),
				sql`${audiobookProgress.audiobookId} IN (${sql.join(items.map(a => sql`${a.id}`), sql`, `)})`
			)
		});

		for (const p of progressRecords) {
			progressMap.set(p.audiobookId, p);
		}
	}

	// Get user library entries
	const libraryMap = new Map<number, UserAudiobook>();
	if (items.length > 0) {
		const libraryEntries = await db.query.userAudiobooks.findMany({
			where: and(
				eq(userAudiobooks.userId, userId),
				sql`${userAudiobooks.audiobookId} IN (${sql.join(items.map(a => sql`${a.id}`), sql`, `)})`
			)
		});

		for (const entry of libraryEntries) {
			libraryMap.set(entry.audiobookId, entry);
		}
	}

	// Enrich items with progress and library status
	let enrichedItems: (AudiobookWithFiles & { inUserLibrary: boolean; userLibraryEntry?: UserAudiobook })[] = items.map(item => ({
		...item,
		userProgress: progressMap.get(item.id) || null,
		inUserLibrary: libraryMap.has(item.id) || item.userId === userId,
		userLibraryEntry: libraryMap.get(item.id)
	}));

	// Apply filter (in_progress, completed, not_started)
	if (filter === 'in_progress') {
		enrichedItems = enrichedItems.filter(item =>
			item.userProgress &&
			(item.userProgress.progress ?? 0) > 0 &&
			!item.userProgress.isFinished
		);
	} else if (filter === 'completed') {
		enrichedItems = enrichedItems.filter(item =>
			item.userProgress?.isFinished
		);
	} else if (filter === 'not_started') {
		enrichedItems = enrichedItems.filter(item =>
			!item.userProgress || (item.userProgress.progress ?? 0) === 0
		);
	}

	// Apply search filter
	if (search) {
		const searchLower = search.toLowerCase();
		enrichedItems = enrichedItems.filter(item =>
			item.title.toLowerCase().includes(searchLower) ||
			item.author?.toLowerCase().includes(searchLower) ||
			item.narratorName?.toLowerCase().includes(searchLower)
		);
	}

	// Get total count based on library filter
	let countCondition;
	if (libraryFilter === 'public') {
		countCondition = eq(audiobooks.libraryType, 'public');
	} else if (libraryFilter === 'personal') {
		countCondition = or(
			eq(audiobooks.userId, userId),
			sql`${audiobooks.id} IN (SELECT audiobookId FROM user_audiobooks WHERE userId = ${userId})`
		);
	} else {
		countCondition = or(
			eq(audiobooks.libraryType, 'public'),
			eq(audiobooks.userId, userId),
			sql`${audiobooks.id} IN (SELECT audiobookId FROM user_audiobooks WHERE userId = ${userId})`
		);
	}

	const totalResult = await db.select({ count: sql<number>`count(*)` })
		.from(audiobooks)
		.where(countCondition);
	const total = totalResult[0]?.count || 0;

	return {
		items: enrichedItems,
		total,
		limit,
		offset
	};
}

/**
 * Set the library type of an audiobook (admin/librarian only)
 */
export async function setAudiobookLibraryType(
	audiobookId: number,
	libraryType: 'personal' | 'public'
): Promise<Audiobook | null> {
	const [updated] = await db.update(audiobooks)
		.set({
			libraryType,
			updatedAt: new Date().toISOString()
		})
		.where(eq(audiobooks.id, audiobookId))
		.returning();

	return updated || null;
}
