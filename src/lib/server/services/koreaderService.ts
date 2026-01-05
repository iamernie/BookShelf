/**
 * KOReader Sync Service
 *
 * Implements the KOSync protocol for syncing reading progress with KOReader devices.
 * https://github.com/koreader/koreader-sync-server
 */

import { db } from '$lib/server/db';
import { koreaderUsers, koreaderProgress, books } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
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

	return {
		document: progress.documentHash,
		progress: progress.progress || '',
		percentage: progress.percentage || 0,
		device: progress.device || 'BookShelf',
		device_id: progress.deviceId || 'bookshelf',
		timestamp: progress.timestamp || Math.floor(Date.now() / 1000)
	};
}

/**
 * Save reading progress for a document
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
	// This is a best-effort attempt - the hash may not match any book
	await tryLinkProgressToBook(userId, data.document);

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
 * Try to link progress to a book by finding a book with matching hash
 * KOReader uses MD5 of the file, but we might need to compute/store this
 */
async function tryLinkProgressToBook(userId: number, documentHash: string): Promise<void> {
	// For now, this is a placeholder. In the future, we could:
	// 1. Compute and store MD5 hashes of ebook files when they're uploaded
	// 2. Try to match by filename patterns
	// 3. Allow manual linking in the UI

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
		return;
	}

	// Future: Add book matching logic here
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
