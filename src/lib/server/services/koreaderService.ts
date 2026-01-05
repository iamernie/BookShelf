/**
 * KOReader Sync Service
 *
 * Implements the KOSync protocol for syncing reading progress with KOReader devices.
 * https://github.com/koreader/koreader-sync-server
 */

import { db } from '$lib/server/db';
import { koreaderUsers, koreaderProgress, books } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';

// ============================================
// Types
// ============================================

export interface KoreaderProgressData {
	document: string; // MD5 hash of the document
	progress: string; // Location/position string
	percentage: number; // 0.0 to 1.0
	device: string;
	device_id: string;
	timestamp?: number; // Unix timestamp
}

export interface KoreaderUserData {
	username: string;
	password: string;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate MD5 hash of a string
 */
export function md5Hash(str: string): string {
	return createHash('md5').update(str).digest('hex');
}

// ============================================
// User Management
// ============================================

/**
 * Validate KOReader credentials using header-based auth
 * Returns the BookShelf user ID if valid, null otherwise
 */
export async function validateKoreaderAuth(
	username: string,
	authKey: string
): Promise<{ userId: number; syncEnabled: boolean } | null> {
	const [koreaderUser] = await db
		.select()
		.from(koreaderUsers)
		.where(eq(koreaderUsers.username, username))
		.limit(1);

	if (!koreaderUser) {
		return null;
	}

	// KOReader sends MD5 hash of the password as x-auth-key
	if (koreaderUser.passwordMd5 !== authKey) {
		return null;
	}

	return {
		userId: koreaderUser.userId,
		syncEnabled: koreaderUser.syncEnabled ?? true
	};
}

/**
 * Get KOReader user by BookShelf user ID
 */
export async function getKoreaderUser(userId: number) {
	const [user] = await db
		.select()
		.from(koreaderUsers)
		.where(eq(koreaderUsers.userId, userId))
		.limit(1);

	return user || null;
}

/**
 * Create or update KOReader credentials for a user
 */
export async function upsertKoreaderUser(
	userId: number,
	username: string,
	password: string
): Promise<{ id: number; username: string }> {
	const passwordMd5 = md5Hash(password);
	const now = new Date().toISOString();

	// Check if user already has KOReader credentials
	const existing = await getKoreaderUser(userId);

	if (existing) {
		// Update existing
		await db
			.update(koreaderUsers)
			.set({
				username,
				password,
				passwordMd5,
				updatedAt: now
			})
			.where(eq(koreaderUsers.userId, userId));

		return { id: existing.id, username };
	} else {
		// Create new
		const result = await db.insert(koreaderUsers).values({
			userId,
			username,
			password,
			passwordMd5,
			syncEnabled: true,
			createdAt: now,
			updatedAt: now
		});

		return { id: Number(result.lastInsertRowid), username };
	}
}

/**
 * Toggle sync enabled/disabled for a user
 */
export async function toggleKoreaderSync(userId: number, enabled: boolean): Promise<void> {
	await db
		.update(koreaderUsers)
		.set({
			syncEnabled: enabled,
			updatedAt: new Date().toISOString()
		})
		.where(eq(koreaderUsers.userId, userId));
}

/**
 * Delete KOReader credentials for a user
 */
export async function deleteKoreaderUser(userId: number): Promise<void> {
	await db.delete(koreaderUsers).where(eq(koreaderUsers.userId, userId));
}

// ============================================
// Progress Sync
// ============================================

/**
 * Get reading progress for a document
 */
export async function getProgress(
	userId: number,
	documentHash: string
): Promise<KoreaderProgressData | null> {
	const [progress] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.userId, userId),
				eq(koreaderProgress.documentHash, documentHash)
			)
		)
		.limit(1);

	if (!progress) {
		return null;
	}

	// KOReader uses XPointer format for EPUB positions (starts with /)
	// If progress was set by browser (CFI or percentage string), return empty
	// so KOReader won't try to GotoXPointer with invalid data
	const progressValue = progress.progress || '';
	const isValidXPointer = progressValue.startsWith('/');

	return {
		document: progress.documentHash,
		progress: isValidXPointer ? progressValue : '',
		percentage: progress.percentage || 0,
		device: progress.device || 'BookShelf',
		device_id: progress.deviceId || 'bookshelf',
		timestamp: progress.timestamp || Math.floor(Date.now() / 1000)
	};
}

/**
 * Save reading progress for a document
 * Also syncs the progress to the linked book's reading progress (for browser reader)
 */
export async function saveProgress(
	userId: number,
	data: KoreaderProgressData
): Promise<KoreaderProgressData> {
	const now = new Date().toISOString();
	const timestamp = data.timestamp || Math.floor(Date.now() / 1000);

	// Check if progress already exists
	const [existing] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.userId, userId),
				eq(koreaderProgress.documentHash, data.document)
			)
		)
		.limit(1);

	if (existing) {
		// Only update if incoming timestamp is newer
		if (!existing.timestamp || timestamp >= existing.timestamp) {
			await db
				.update(koreaderProgress)
				.set({
					progress: data.progress,
					percentage: data.percentage,
					device: data.device,
					deviceId: data.device_id,
					timestamp: timestamp,
					updatedAt: now
				})
				.where(eq(koreaderProgress.id, existing.id));
		}
	} else {
		// Create new progress entry
		await db.insert(koreaderProgress).values({
			userId,
			documentHash: data.document,
			progress: data.progress,
			percentage: data.percentage,
			device: data.device,
			deviceId: data.device_id,
			timestamp: timestamp,
			createdAt: now,
			updatedAt: now
		});
	}

	// Try to link progress to a book by matching document hash
	// This also returns the book ID if a match is found
	const bookId = await tryLinkProgressToBook(userId, data.document);

	// Sync progress to the book's reading progress for the browser reader
	if (bookId && data.percentage !== undefined) {
		await syncProgressToBook(bookId, data.percentage, data.progress, now);
	}

	return {
		document: data.document,
		progress: data.progress,
		percentage: data.percentage,
		device: data.device,
		device_id: data.device_id,
		timestamp: timestamp
	};
}

/**
 * Sync KOReader progress to the book's reading progress
 * This allows the browser reader to continue where KOReader left off
 */
async function syncProgressToBook(
	bookId: number,
	percentage: number,
	location: string | undefined,
	timestamp: string
): Promise<void> {
	// Update the book's reading progress
	// KOReader stores percentage as 0-1, but BookShelf browser reader expects 0-100
	// Convert to 0-100 format for consistency with browser reader
	const percentageAs100 = percentage * 100;
	const readingProgress = JSON.stringify({
		location: location || '',
		percentage: percentageAs100,
		chapter: undefined,
		currentPage: undefined,
		totalPages: undefined,
		savedAt: timestamp,
		source: 'koreader' // Mark that this came from KOReader
	});

	await db
		.update(books)
		.set({
			readingProgress,
			lastReadAt: timestamp,
			updatedAt: timestamp
		})
		.where(eq(books.id, bookId));
}

/**
 * Try to link progress to a book by finding a book with matching MD5 hash
 * KOReader sends the MD5 hash of the ebook file as the document identifier
 */
async function tryLinkProgressToBook(userId: number, documentHash: string): Promise<number | null> {
	// Check if we already have a progress entry with a linked book
	const [progress] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.userId, userId),
				eq(koreaderProgress.documentHash, documentHash)
			)
		)
		.limit(1);

	if (progress?.bookId) {
		// Already linked
		return progress.bookId;
	}

	// Try to find a book with matching MD5 hash
	const [matchingBook] = await db
		.select({ id: books.id })
		.from(books)
		.where(eq(books.ebookMd5, documentHash))
		.limit(1);

	if (matchingBook) {
		// Link the progress entry to the book
		await db
			.update(koreaderProgress)
			.set({
				bookId: matchingBook.id,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(koreaderProgress.userId, userId),
					eq(koreaderProgress.documentHash, documentHash)
				)
			);

		return matchingBook.id;
	}

	return null;
}

/**
 * Get all progress entries for a user
 */
export async function getAllProgress(userId: number) {
	return await db
		.select({
			id: koreaderProgress.id,
			documentHash: koreaderProgress.documentHash,
			progress: koreaderProgress.progress,
			percentage: koreaderProgress.percentage,
			device: koreaderProgress.device,
			timestamp: koreaderProgress.timestamp,
			bookId: koreaderProgress.bookId,
			bookTitle: books.title
		})
		.from(koreaderProgress)
		.leftJoin(books, eq(koreaderProgress.bookId, books.id))
		.where(eq(koreaderProgress.userId, userId))
		.orderBy(koreaderProgress.timestamp);
}

/**
 * Get recent sync activity for a user (last N updates, ordered by most recent first)
 */
export async function getRecentProgress(userId: number, limit: number = 5) {
	return await db
		.select({
			id: koreaderProgress.id,
			documentHash: koreaderProgress.documentHash,
			percentage: koreaderProgress.percentage,
			device: koreaderProgress.device,
			timestamp: koreaderProgress.timestamp,
			updatedAt: koreaderProgress.updatedAt,
			bookId: koreaderProgress.bookId,
			bookTitle: books.title
		})
		.from(koreaderProgress)
		.leftJoin(books, eq(koreaderProgress.bookId, books.id))
		.where(eq(koreaderProgress.userId, userId))
		.orderBy(desc(koreaderProgress.updatedAt))
		.limit(limit);
}

/**
 * Manually link a progress entry to a book
 */
export async function linkProgressToBook(
	progressId: number,
	bookId: number,
	userId: number
): Promise<void> {
	await db
		.update(koreaderProgress)
		.set({
			bookId,
			updatedAt: new Date().toISOString()
		})
		.where(
			and(
				eq(koreaderProgress.id, progressId),
				eq(koreaderProgress.userId, userId)
			)
		);
}

export interface SyncResult {
	synced: boolean;
	reason: 'success' | 'no_credentials' | 'sync_disabled' | 'no_md5_hash' | 'error';
}

/**
 * Sync browser reader progress to KOReader
 * Called when user reads in the browser and we want KOReader to pick up the progress
 *
 * @param percentage - Progress as 0-100 (browser format), will be converted to 0-1 for KOReader
 */
export async function syncProgressFromBrowser(
	userId: number,
	bookId: number,
	percentage: number,
	location: string
): Promise<SyncResult> {
	// First, check if the user has KOReader sync enabled
	const koreaderUser = await getKoreaderUser(userId);
	if (!koreaderUser) {
		console.log(`[KOReader Sync] User ${userId} has no KOReader credentials configured`);
		return { synced: false, reason: 'no_credentials' };
	}
	if (!koreaderUser.syncEnabled) {
		console.log(`[KOReader Sync] User ${userId} has KOReader sync disabled`);
		return { synced: false, reason: 'sync_disabled' };
	}

	// Get the book's MD5 hash to find the corresponding KOReader progress entry
	const [book] = await db
		.select({ ebookMd5: books.ebookMd5, title: books.title })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book?.ebookMd5) {
		// Book doesn't have an MD5 hash (no ebook file or hash not computed)
		console.log(`[KOReader Sync] Book ${bookId} (${book?.title}) has no MD5 hash - run POST /api/admin/rehash-ebooks to fix`);
		return { synced: false, reason: 'no_md5_hash' };
	}

	const now = new Date().toISOString();
	const timestamp = Math.floor(Date.now() / 1000);

	// Convert percentage from browser format (0-100) to KOReader format (0-1)
	const koreaderPercentage = percentage / 100;

	// Check if progress entry exists
	const [existing] = await db
		.select()
		.from(koreaderProgress)
		.where(
			and(
				eq(koreaderProgress.userId, userId),
				eq(koreaderProgress.documentHash, book.ebookMd5)
			)
		)
		.limit(1);

	if (existing) {
		// Update existing progress - only if browser timestamp is newer
		if (!existing.timestamp || timestamp >= existing.timestamp) {
			// IMPORTANT: Don't overwrite progress field with EPUB CFI - KOReader uses XPointer format
			// If KOReader previously set an XPointer, keep it. KOReader will use percentage to navigate.
			// Only update progress if it was never set or was set by browser (starts with 'epubcfi')
			const shouldUpdateProgress = !existing.progress || existing.progress.startsWith('epubcfi');

			await db
				.update(koreaderProgress)
				.set({
					// Keep existing XPointer if set by KOReader, otherwise store percentage as string
					progress: shouldUpdateProgress ? String(koreaderPercentage) : existing.progress,
					percentage: koreaderPercentage,
					device: 'BookShelf Browser',
					deviceId: 'bookshelf-browser',
					timestamp,
					updatedAt: now
				})
				.where(eq(koreaderProgress.id, existing.id));
			console.log(`[KOReader Sync] Updated progress for book ${bookId} (${book.title}): ${percentage}% browser → ${koreaderPercentage} KOReader format, timestamp=${timestamp}`);
		} else {
			console.log(`[KOReader Sync] Skipped update for book ${bookId} - existing timestamp ${existing.timestamp} is newer than ${timestamp}`);
		}
	} else {
		// Create new progress entry linked to this book
		// Store percentage as progress string since we don't have XPointer from KOReader yet
		await db.insert(koreaderProgress).values({
			userId,
			bookId,
			documentHash: book.ebookMd5,
			progress: String(koreaderPercentage), // Use percentage, not EPUB CFI
			percentage: koreaderPercentage,
			device: 'BookShelf Browser',
			deviceId: 'bookshelf-browser',
			timestamp,
			createdAt: now,
			updatedAt: now
		});
		console.log(`[KOReader Sync] Created new progress entry for book ${bookId} (${book.title}) at ${Math.round(koreaderPercentage * 100)}%`);
	}

	return { synced: true, reason: 'success' };
}
