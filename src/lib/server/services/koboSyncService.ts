/**
 * Kobo Library Sync Service
 *
 * Orchestrates library synchronization between BookShelf and Kobo devices.
 * Handles:
 * - Incremental sync with pagination
 * - Sync token management
 * - New/removed book detection
 */

import {
	getUnsyncedBooks,
	getRemovedBooks,
	markBooksSynced,
	markBookRemoved
} from './koboService';
import { generateEntitlements, type Entitlement, type NewEntitlement } from './koboEntitlementService';

// ============================================
// Types
// ============================================

export interface SyncToken {
	ongoingSyncPointId: string | null;
	lastSuccessfulSyncPointId: string | null;
	lastSyncedBookIds?: number[];
}

export interface SyncResult {
	entitlements: Entitlement[];
	syncToken: SyncToken;
	shouldContinue: boolean;
}

// ============================================
// Sync Token Management
// ============================================

const SYNC_TOKEN_PREFIX = 'BOOKSHELF.';

/**
 * Parse a sync token from base64 header
 */
export function parseSyncToken(tokenHeader: string | null): SyncToken {
	if (!tokenHeader) {
		return {
			ongoingSyncPointId: null,
			lastSuccessfulSyncPointId: null
		};
	}

	try {
		// Remove prefix if present
		let tokenStr = tokenHeader;
		if (tokenStr.startsWith(SYNC_TOKEN_PREFIX)) {
			tokenStr = tokenStr.slice(SYNC_TOKEN_PREFIX.length);
		}

		const decoded = Buffer.from(tokenStr, 'base64').toString('utf-8');
		return JSON.parse(decoded);
	} catch {
		return {
			ongoingSyncPointId: null,
			lastSuccessfulSyncPointId: null
		};
	}
}

/**
 * Encode a sync token to base64 for header
 */
export function encodeSyncToken(token: SyncToken): string {
	const json = JSON.stringify(token);
	const base64 = Buffer.from(json).toString('base64');
	return SYNC_TOKEN_PREFIX + base64;
}

// ============================================
// Library Sync
// ============================================

const MAX_ENTITLEMENTS_PER_SYNC = 5;

/**
 * Perform library sync for a user
 *
 * This implements paginated sync:
 * 1. Get unsynced books (new books to add)
 * 2. Get removed books (books to remove from device)
 * 3. Return entitlements with continuation token if more available
 */
export async function syncLibrary(
	userId: number,
	baseUrl: string,
	token: string,
	syncTokenHeader: string | null
): Promise<SyncResult> {
	const syncToken = parseSyncToken(syncTokenHeader);
	const entitlements: Entitlement[] = [];
	let remainingSlots = MAX_ENTITLEMENTS_PER_SYNC;
	let shouldContinue = false;

	// Get new books to sync
	const newBookIds = await getUnsyncedBooks(userId, remainingSlots);

	if (newBookIds.length > 0) {
		const newEntitlements = await generateEntitlements(
			userId,
			newBookIds,
			baseUrl,
			token,
			'new'
		);
		entitlements.push(...newEntitlements);
		remainingSlots -= newEntitlements.length;

		// Only mark books as synced if entitlements were actually generated
		// (books without ebook files won't generate entitlements)
		if (newEntitlements.length > 0) {
			// Extract book IDs from the entitlements that were actually generated
			const syncedBookIds = newEntitlements
				.filter((e): e is NewEntitlement => 'NewEntitlement' in e)
				.map(e => {
					// Extract book ID from the entitlement - it's in the download URL
					const url = e.NewEntitlement.BookMetadata.DownloadUrls[0]?.Url || '';
					const match = url.match(/\/books\/(\d+)\/download/);
					return match ? parseInt(match[1], 10) : null;
				})
				.filter((id): id is number => id !== null);

			if (syncedBookIds.length > 0) {
				await markBooksSynced(userId, syncedBookIds);
			}
		}

		// Check if there are more new books
		const moreNewBooks = await getUnsyncedBooks(userId, 1);
		if (moreNewBooks.length > 0) {
			shouldContinue = true;
		}
	}

	// If we have slots remaining, handle removed books
	if (remainingSlots > 0 && !shouldContinue) {
		const removedBookIds = await getRemovedBooks(userId, remainingSlots);

		if (removedBookIds.length > 0) {
			const removedEntitlements = await generateEntitlements(
				userId,
				removedBookIds,
				baseUrl,
				token,
				'removed'
			);
			entitlements.push(...removedEntitlements);

			// Mark these books as removed
			for (const bookId of removedBookIds) {
				await markBookRemoved(userId, bookId);
			}

			// Check if there are more removed books
			const moreRemovedBooks = await getRemovedBooks(userId, 1);
			if (moreRemovedBooks.length > 0) {
				shouldContinue = true;
			}
		}
	}

	// Update sync token
	const newSyncToken: SyncToken = {
		ongoingSyncPointId: shouldContinue ? crypto.randomUUID() : null,
		lastSuccessfulSyncPointId: shouldContinue
			? syncToken.lastSuccessfulSyncPointId
			: crypto.randomUUID()
	};

	return {
		entitlements,
		syncToken: newSyncToken,
		shouldContinue
	};
}

/**
 * Get sync statistics for a user
 */
export async function getSyncStats(userId: number): Promise<{
	totalTagged: number;
	synced: number;
	pendingSync: number;
}> {
	const { getKoboTaggedBooks } = await import('./koboService');

	const taggedBooks = await getKoboTaggedBooks(userId);
	const unsyncedBooks = await getUnsyncedBooks(userId, 1000);

	return {
		totalTagged: taggedBooks.length,
		synced: taggedBooks.length - unsyncedBooks.length,
		pendingSync: unsyncedBooks.length
	};
}
