/**
 * Kobo Sync Service
 *
 * Handles Kobo device integration including:
 * - User token management
 * - Device authentication
 * - Settings management
 */

import { db } from '$lib/server/db';
import { koboUsers, koboDevices, koboSyncState, koboReadingState, tags, bookTags, books } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface KoboUserSettings {
	token: string;
	syncEnabled: boolean;
	syncUrl?: string;
	configured: boolean;
}

export interface KoboDevice {
	id: number;
	deviceId: string;
	deviceModel: string | null;
	lastSyncAt: string | null;
}

// ============================================
// Token Management
// ============================================

/**
 * Generate a unique sync token for a user
 */
export function generateToken(): string {
	return randomUUID();
}

/**
 * Validate a sync token and return the associated user ID
 */
export async function validateToken(token: string): Promise<{ userId: number; syncEnabled: boolean } | null> {
	const [user] = await db
		.select()
		.from(koboUsers)
		.where(eq(koboUsers.token, token))
		.limit(1);

	if (!user) {
		return null;
	}

	return {
		userId: user.userId,
		syncEnabled: user.syncEnabled ?? true
	};
}

// ============================================
// User Settings
// ============================================

/**
 * Get Kobo settings for a user
 */
export async function getKoboSettings(userId: number): Promise<KoboUserSettings | null> {
	const [settings] = await db
		.select()
		.from(koboUsers)
		.where(eq(koboUsers.userId, userId))
		.limit(1);

	if (!settings) {
		return null;
	}

	return {
		token: settings.token,
		syncEnabled: settings.syncEnabled ?? true,
		configured: true
	};
}

/**
 * Create or update Kobo settings for a user
 */
export async function upsertKoboSettings(userId: number): Promise<KoboUserSettings> {
	const now = new Date().toISOString();
	const existing = await getKoboSettings(userId);

	if (existing) {
		return existing;
	}

	// Create new settings with generated token
	const token = generateToken();

	await db.insert(koboUsers).values({
		userId,
		token,
		syncEnabled: true,
		createdAt: now,
		updatedAt: now
	});

	// Ensure "kobo" tag exists
	await ensureKoboTag();

	return {
		token,
		syncEnabled: true,
		configured: true
	};
}

/**
 * Regenerate the sync token for a user
 */
export async function regenerateToken(userId: number): Promise<string> {
	const now = new Date().toISOString();
	const token = generateToken();

	await db
		.update(koboUsers)
		.set({
			token,
			updatedAt: now
		})
		.where(eq(koboUsers.userId, userId));

	return token;
}

/**
 * Toggle sync enabled/disabled
 */
export async function toggleSync(userId: number): Promise<boolean> {
	const settings = await getKoboSettings(userId);
	if (!settings) {
		return false;
	}

	const newState = !settings.syncEnabled;
	const now = new Date().toISOString();

	await db
		.update(koboUsers)
		.set({
			syncEnabled: newState,
			updatedAt: now
		})
		.where(eq(koboUsers.userId, userId));

	return newState;
}

/**
 * Delete Kobo settings for a user
 */
export async function deleteKoboSettings(userId: number): Promise<void> {
	// Delete all related data
	await db.delete(koboReadingState).where(eq(koboReadingState.userId, userId));
	await db.delete(koboSyncState).where(eq(koboSyncState.userId, userId));
	await db.delete(koboDevices).where(eq(koboDevices.userId, userId));
	await db.delete(koboUsers).where(eq(koboUsers.userId, userId));
}

// ============================================
// Device Management
// ============================================

/**
 * Register or update a Kobo device
 */
export async function registerDevice(
	userId: number,
	deviceId: string,
	deviceModel?: string
): Promise<{ accessToken: string; refreshToken: string }> {
	const now = new Date().toISOString();
	const accessToken = randomUUID();
	const refreshToken = randomUUID();

	// Check if device already exists
	const [existing] = await db
		.select()
		.from(koboDevices)
		.where(and(eq(koboDevices.userId, userId), eq(koboDevices.deviceId, deviceId)))
		.limit(1);

	if (existing) {
		// Update existing device
		await db
			.update(koboDevices)
			.set({
				accessToken,
				refreshToken,
				deviceModel: deviceModel || existing.deviceModel,
				updatedAt: now
			})
			.where(eq(koboDevices.id, existing.id));
	} else {
		// Create new device
		await db.insert(koboDevices).values({
			userId,
			deviceId,
			deviceModel,
			accessToken,
			refreshToken,
			createdAt: now,
			updatedAt: now
		});
	}

	return { accessToken, refreshToken };
}

/**
 * Update last sync time for a device
 */
export async function updateDeviceLastSync(userId: number, deviceId: string): Promise<void> {
	const now = new Date().toISOString();

	await db
		.update(koboDevices)
		.set({
			lastSyncAt: now,
			updatedAt: now
		})
		.where(and(eq(koboDevices.userId, userId), eq(koboDevices.deviceId, deviceId)));
}

/**
 * Get devices for a user
 */
export async function getDevices(userId: number): Promise<KoboDevice[]> {
	const devices = await db
		.select({
			id: koboDevices.id,
			deviceId: koboDevices.deviceId,
			deviceModel: koboDevices.deviceModel,
			lastSyncAt: koboDevices.lastSyncAt
		})
		.from(koboDevices)
		.where(eq(koboDevices.userId, userId));

	return devices;
}

// ============================================
// Tag Management
// ============================================

/**
 * Ensure the "kobo" tag exists (global tag)
 * Returns the tag ID
 */
export async function ensureKoboTag(): Promise<number> {
	// Check if "kobo" tag exists
	const [existing] = await db
		.select()
		.from(tags)
		.where(eq(tags.name, 'kobo'))
		.limit(1);

	if (existing) {
		return existing.id;
	}

	// Create the tag
	const now = new Date().toISOString();
	const result = await db.insert(tags).values({
		name: 'kobo',
		color: '#1a73e8', // Kobo blue
		createdAt: now,
		updatedAt: now
	});

	return Number(result.lastInsertRowid);
}

/**
 * Get the "kobo" tag ID (global tag)
 */
export async function getKoboTagId(): Promise<number | null> {
	const [tag] = await db
		.select()
		.from(tags)
		.where(eq(tags.name, 'kobo'))
		.limit(1);

	return tag?.id ?? null;
}

/**
 * Get all books tagged with "kobo" for a user (owned by that user or unowned)
 */
export async function getKoboTaggedBooks(userId: number): Promise<number[]> {
	console.log(`[KoboService] getKoboTaggedBooks(userId=${userId})`);

	const tagId = await getKoboTagId();
	console.log(`[KoboService] "kobo" tag ID:`, tagId);
	if (!tagId) {
		console.log(`[KoboService] No "kobo" tag found, returning empty array`);
		return [];
	}

	// Get books tagged with "kobo" that are either:
	// 1. Owned by this user (ownerId = userId)
	// 2. Unowned (ownerId is null) - for backwards compatibility with single-user setups
	const taggedBooks = await db
		.select({ bookId: bookTags.bookId, ownerId: books.ownerId })
		.from(bookTags)
		.innerJoin(books, eq(bookTags.bookId, books.id))
		.where(eq(bookTags.tagId, tagId));

	console.log(`[KoboService] All books with "kobo" tag:`, taggedBooks);

	// Filter to books owned by user or unowned
	const filtered = taggedBooks
		.filter((b) => b.ownerId === userId || b.ownerId === null)
		.map((b) => b.bookId);

	console.log(`[KoboService] Books filtered for user ${userId} (owned or unowned):`, filtered);
	return filtered;
}

// ============================================
// Sync State Management
// ============================================

/**
 * Get or create sync state for a book
 */
export async function getOrCreateSyncState(
	userId: number,
	bookId: number
): Promise<{ entitlementId: string; synced: boolean }> {
	const [existing] = await db
		.select()
		.from(koboSyncState)
		.where(and(eq(koboSyncState.userId, userId), eq(koboSyncState.bookId, bookId)))
		.limit(1);

	if (existing) {
		return {
			entitlementId: existing.entitlementId,
			synced: existing.synced ?? false
		};
	}

	// Create new sync state
	const now = new Date().toISOString();
	const entitlementId = randomUUID();

	await db.insert(koboSyncState).values({
		userId,
		bookId,
		entitlementId,
		synced: false,
		removed: false,
		createdAt: now,
		updatedAt: now
	});

	return {
		entitlementId,
		synced: false
	};
}

/**
 * Mark books as synced
 */
export async function markBooksSynced(userId: number, bookIds: number[]): Promise<void> {
	if (bookIds.length === 0) return;

	const now = new Date().toISOString();

	await db
		.update(koboSyncState)
		.set({
			synced: true,
			lastSyncedAt: now,
			updatedAt: now
		})
		.where(and(eq(koboSyncState.userId, userId), inArray(koboSyncState.bookId, bookIds)));
}

/**
 * Mark a book as removed from sync
 */
export async function markBookRemoved(userId: number, bookId: number): Promise<void> {
	const now = new Date().toISOString();

	await db
		.update(koboSyncState)
		.set({
			removed: true,
			updatedAt: now
		})
		.where(and(eq(koboSyncState.userId, userId), eq(koboSyncState.bookId, bookId)));
}

/**
 * Get unsynced books (tagged with "kobo" but not yet sent to device)
 */
export async function getUnsyncedBooks(userId: number, limit: number = 5): Promise<number[]> {
	console.log(`[KoboService] getUnsyncedBooks(userId=${userId}, limit=${limit})`);

	const koboBookIds = await getKoboTaggedBooks(userId);
	if (koboBookIds.length === 0) {
		console.log(`[KoboService] No kobo-tagged books found`);
		return [];
	}

	// Find books that are tagged but either not in sync state or not synced
	const syncedStates = await db
		.select()
		.from(koboSyncState)
		.where(
			and(
				eq(koboSyncState.userId, userId),
				inArray(koboSyncState.bookId, koboBookIds),
				eq(koboSyncState.synced, true),
				eq(koboSyncState.removed, false)
			)
		);

	console.log(`[KoboService] Sync states (synced=true, removed=false):`, syncedStates.map(s => ({
		bookId: s.bookId,
		synced: s.synced,
		removed: s.removed,
		entitlementId: s.entitlementId?.substring(0, 8)
	})));

	const syncedBookIds = new Set(syncedStates.map((s) => s.bookId));
	const unsyncedBookIds = koboBookIds.filter((id) => !syncedBookIds.has(id));

	console.log(`[KoboService] Synced book IDs:`, [...syncedBookIds]);
	console.log(`[KoboService] Unsynced book IDs (before limit):`, unsyncedBookIds);
	console.log(`[KoboService] Returning ${Math.min(unsyncedBookIds.length, limit)} unsynced books`);

	return unsyncedBookIds.slice(0, limit);
}

/**
 * Get books that were synced but are no longer tagged with "kobo"
 */
export async function getRemovedBooks(userId: number, limit: number = 5): Promise<number[]> {
	const koboBookIds = await getKoboTaggedBooks(userId);
	const koboBookIdSet = new Set(koboBookIds);

	// Find sync states that are synced but the book is no longer tagged
	const syncedStates = await db
		.select()
		.from(koboSyncState)
		.where(
			and(
				eq(koboSyncState.userId, userId),
				eq(koboSyncState.synced, true),
				eq(koboSyncState.removed, false)
			)
		);

	const removedBookIds = syncedStates
		.filter((s) => !koboBookIdSet.has(s.bookId))
		.map((s) => s.bookId);

	return removedBookIds.slice(0, limit);
}

/**
 * Remove the kobo tag from a book (called when Kobo device deletes from library)
 */
export async function removeKoboTagFromBook(userId: number, bookId: number): Promise<void> {
	const tagId = await getKoboTagId();
	if (!tagId) {
		return;
	}

	// Remove the tag from the book
	await db
		.delete(bookTags)
		.where(and(eq(bookTags.bookId, bookId), eq(bookTags.tagId, tagId)));

	// Mark as removed in sync state
	await markBookRemoved(userId, bookId);
}
