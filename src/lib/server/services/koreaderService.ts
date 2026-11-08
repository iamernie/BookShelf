/**
 * KOReader Sync Service
 *
 * Implements the KOSync protocol for syncing reading progress with KOReader devices.
 * https://github.com/koreader/koreader-sync-server
 */

import { db } from '$lib/server/db';
import { koreaderUsers, koreaderProgress, books, userBooks } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { writeOwnPosition } from './personalState';
import { createHash } from 'crypto';
import { findBookForHash } from './ebookHashService';
import { holdsBook } from './libraryShareService';

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

// ============================================
// Utility Functions
// ============================================

/**
 * Generate MD5 hash of a string
 *
 * NOTE: MD5 is used here for KOReader sync protocol compatibility, NOT for password security.
 * KOReader's sync protocol requires MD5 hashes for document fingerprinting and authentication.
 * This is a protocol requirement that cannot be changed without breaking KOReader compatibility.
 * The actual user passwords are hashed with bcrypt in authService.ts.
 *
 * @see https://github.com/koreader/koreader-sync-server
 */
export function md5Hash(str: string): string {
	// lgtm[js/insufficient-password-hash] - Required for KOReader protocol compatibility
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
 *
 * IMPORTANT: KOReader can only navigate to an XPointer (reflowable formats) or a page number
 * (PDF, CBZ). Anything else, like the browser's EPUB CFI, returns null so KOReader doesn't
 * show a sync prompt it can't act on.
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

	const progressValue = progress.progress || '';
	const isNavigable = progressValue.startsWith('/') || /^\d+$/.test(progressValue);

	if (!isNavigable) {
		// Nothing KOReader can go to - don't advertise progress
		// KOReader will sync its own progress TO us when user reads on device
		console.log(
			`[KOReader GET] No navigable position for document ${documentHash.substring(0, 8)}... ` +
				`(progress="${progressValue.substring(0, 20)}...") - returning null`
		);
		return null;
	}

	return {
		document: progress.documentHash,
		progress: progressValue,
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

	let written = true;

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
		written = !existing.timestamp || timestamp >= existing.timestamp;
		if (written) {
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
	// A stale push kept the row as it was, so it says nothing new about the book either
	if (bookId && written) {
		await syncProgressToBook(userId, bookId, data.percentage, data.progress, now);
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
 * Convert a KOReader page position to the browser reader's page convention.
 * KOReader pages are 1-based; the PDF reader's are too, the CBZ reader's are 0-based indexes.
 * Returns undefined when the position isn't a page, like an EPUB XPointer.
 */
function toReaderPage(format: string | null | undefined, location: string | undefined): number | undefined {
	const kind = format?.toLowerCase();
	if ((kind !== 'pdf' && kind !== 'cbz') || !/^\d+$/.test(location ?? '')) {
		return undefined;
	}

	const page = parseInt(location!);
	if (page < 1) {
		return undefined;
	}

	return kind === 'cbz' ? page - 1 : page;
}

/**
 * Sync KOReader progress to the user's own reading position (user_books), so the browser reader
 * continues where KOReader left off: position, percent and last-read; no status. Only books in the
 * user's library link (tryLinkProgressToBook), and no row is ever created here.
 */
async function syncProgressToBook(
	userId: number,
	bookId: number,
	percentage: number,
	location: string | undefined,
	timestamp: string
): Promise<void> {
	const [book] = await db
		.select({ ebookFormat: books.ebookFormat })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	// KOReader stores percentage as 0-1, but BookShelf browser reader expects 0-100
	// Convert to 0-100 format for consistency with browser reader
	const percentageAs100 = percentage * 100;
	const readingProgress = JSON.stringify({
		location: location || '',
		percentage: percentageAs100,
		chapter: undefined,
		currentPage: toReaderPage(book?.ebookFormat, location),
		totalPages: undefined,
		savedAt: timestamp,
		source: 'koreader' // Mark that this came from KOReader
	});

	await writeOwnPosition(userId, bookId, readingProgress, percentageAs100, timestamp);
}

/**
 * Try to link progress to a book by finding a book that knows this document hash
 * KOReader sends the partial MD5 of the ebook file as the document identifier
 * Returns the book to sync to, or null if there is none in the user's library
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
		// Already linked, but the book may have left their library since
		return (await holdsBook(userId, progress.bookId)) ? progress.bookId : null;
	}

	const matchingBookId = await findBookForHash(userId, documentHash);

	if (matchingBookId) {
		// Link the progress entry to the book
		await db
			.update(koreaderProgress)
			.set({
				bookId: matchingBookId,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(koreaderProgress.userId, userId),
					eq(koreaderProgress.documentHash, documentHash)
				)
			);

		return matchingBookId;
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

export interface SyncResult {
	synced: boolean;
	reason: 'success' | 'no_credentials' | 'sync_disabled' | 'no_md5_hash' | 'no_position' | 'stale' | 'error';
}

/**
 * Sync browser reader progress to KOReader
 * Called when user reads in the browser and we want KOReader to pick up the progress
 *
 * Only PDF and CBZ qualify: a browser page is a position KOReader can navigate to, an EPUB CFI
 * isn't. Reads stay per-hash because positions are file-specific, so this writes only the row
 * for the book's current hash.
 *
 * @param percentage - Progress as 0-100 (browser format), will be converted to 0-1 for KOReader
 * @param currentPage - The reader's page: 1-based for PDF, 0-based index for CBZ
 */
export async function syncProgressFromBrowser(
	userId: number,
	bookId: number,
	percentage: number,
	currentPage: number | undefined
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
		.select({ ebookFormat: books.ebookFormat, ebookMd5: books.ebookMd5, title: books.title })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	const format = book?.ebookFormat?.toLowerCase();
	if ((format !== 'pdf' && format !== 'cbz') || !Number.isInteger(currentPage)) {
		return { synced: false, reason: 'no_position' };
	}

	if (!book?.ebookMd5) {
		// Book doesn't have an MD5 hash (no ebook file or hash not computed)
		console.log(`[KOReader Sync] Book ${bookId} (${book?.title}) has no MD5 hash - run POST /api/admin/rehash-ebooks to fix`);
		return { synced: false, reason: 'no_md5_hash' };
	}

	const koreaderPage = format === 'cbz' ? currentPage! + 1 : currentPage!;
	if (koreaderPage < 1) {
		return { synced: false, reason: 'no_position' };
	}

	const now = new Date().toISOString();
	const timestamp = Math.floor(Date.now() / 1000);

	// Convert percentage from browser format (0-100) to KOReader format (0-1)
	const koreaderPercentage = percentage / 100;

	const position = {
		progress: String(koreaderPage),
		percentage: koreaderPercentage,
		device: 'BookShelf Browser',
		deviceId: 'bookshelf-browser',
		timestamp,
		updatedAt: now
	};

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
		// A position that isn't a page (a stray XPointer) is never overwritten with one
		if (!/^\d*$/.test(existing.progress ?? '')) {
			return { synced: false, reason: 'no_position' };
		}

		// Update existing progress - only if browser timestamp is newer
		if (existing.timestamp && timestamp < existing.timestamp) {
			console.log(`[KOReader Sync] Skipped update for book ${bookId} - existing timestamp ${existing.timestamp} is newer than ${timestamp}`);
			return { synced: false, reason: 'stale' };
		}

		await db.update(koreaderProgress).set(position).where(eq(koreaderProgress.id, existing.id));
		console.log(`[KOReader Sync] Updated progress for book ${bookId} (${book.title}): page ${koreaderPage}, ${percentage}%`);
	} else {
		// Create new progress entry linked to this book
		await db.insert(koreaderProgress).values({
			...position,
			userId,
			bookId,
			documentHash: book.ebookMd5,
			createdAt: now
		});
		console.log(`[KOReader Sync] Created progress entry for book ${bookId} (${book.title}): page ${koreaderPage}, ${percentage}%`);
	}

	return { synced: true, reason: 'success' };
}
