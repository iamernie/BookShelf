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
	markBookRemoved,
	getKoboTaggedBooks,
	getUnsyncedReadingStates,
	markReadingStatesSynced
} from './koboService';
import { generateEntitlements, generateChangedReadingState, generateChangedEntitlementWithReadingState, type Entitlement, type NewEntitlement } from './koboEntitlementService';

const LOG_PREFIX = '[KoboSync]';

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
	console.log(`${LOG_PREFIX} parseSyncToken called with:`, tokenHeader ? `"${tokenHeader.substring(0, 50)}..."` : 'null');

	if (!tokenHeader) {
		console.log(`${LOG_PREFIX} No sync token provided, returning fresh token`);
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
			console.log(`${LOG_PREFIX} Removed BOOKSHELF prefix from token`);
		}

		const decoded = Buffer.from(tokenStr, 'base64').toString('utf-8');
		const parsed = JSON.parse(decoded);
		console.log(`${LOG_PREFIX} Parsed sync token:`, JSON.stringify(parsed));
		return parsed;
	} catch (err) {
		console.log(`${LOG_PREFIX} Failed to parse sync token:`, err);
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
	const encoded = SYNC_TOKEN_PREFIX + base64;
	console.log(`${LOG_PREFIX} encodeSyncToken:`, JSON.stringify(token), '->', encoded.substring(0, 50) + '...');
	return encoded;
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
	console.log(`${LOG_PREFIX} ========== syncLibrary START ==========`);
	console.log(`${LOG_PREFIX} userId: ${userId}`);
	console.log(`${LOG_PREFIX} baseUrl: ${baseUrl}`);
	console.log(`${LOG_PREFIX} token: ${token.substring(0, 8)}...`);

	const syncToken = parseSyncToken(syncTokenHeader);
	const entitlements: Entitlement[] = [];
	let remainingSlots = MAX_ENTITLEMENTS_PER_SYNC;
	let shouldContinue = false;

	// First, let's see what books are tagged with "kobo" for this user
	const taggedBooks = await getKoboTaggedBooks(userId);
	console.log(`${LOG_PREFIX} Books tagged with "kobo" for user ${userId}:`, taggedBooks);

	// Get new books to sync
	console.log(`${LOG_PREFIX} Calling getUnsyncedBooks(${userId}, ${remainingSlots})`);
	const newBookIds = await getUnsyncedBooks(userId, remainingSlots);
	console.log(`${LOG_PREFIX} Unsynced book IDs:`, newBookIds);

	if (newBookIds.length > 0) {
		console.log(`${LOG_PREFIX} Generating entitlements for ${newBookIds.length} new books`);
		const newEntitlements = await generateEntitlements(
			userId,
			newBookIds,
			baseUrl,
			token,
			'new'
		);
		console.log(`${LOG_PREFIX} Generated ${newEntitlements.length} new entitlements`);

		// Log each entitlement in detail
		for (let i = 0; i < newEntitlements.length; i++) {
			const ent = newEntitlements[i];
			if ('NewEntitlement' in ent) {
				console.log(`${LOG_PREFIX} Entitlement[${i}]: NewEntitlement`);
				console.log(`${LOG_PREFIX}   - Title: ${ent.NewEntitlement.BookMetadata.Title}`);
				console.log(`${LOG_PREFIX}   - EntitlementId: ${ent.NewEntitlement.BookMetadata.EntitlementId}`);
				console.log(`${LOG_PREFIX}   - DownloadUrls: ${JSON.stringify(ent.NewEntitlement.BookMetadata.DownloadUrls)}`);
				console.log(`${LOG_PREFIX}   - Format: ${ent.NewEntitlement.BookMetadata.DownloadUrls[0]?.Format}`);
				console.log(`${LOG_PREFIX}   - Size: ${ent.NewEntitlement.BookMetadata.DownloadUrls[0]?.Size}`);
				console.log(`${LOG_PREFIX}   - DrmType: ${ent.NewEntitlement.BookMetadata.DownloadUrls[0]?.DrmType}`);
			} else if ('ChangedEntitlement' in ent) {
				console.log(`${LOG_PREFIX} Entitlement[${i}]: ChangedEntitlement`);
				console.log(`${LOG_PREFIX}   - IsRemoved: ${ent.ChangedEntitlement.BookEntitlement.IsRemoved}`);
				if (ent.ChangedEntitlement.ReadingState) {
					console.log(`${LOG_PREFIX}   - ReadingState.ProgressPercent: ${ent.ChangedEntitlement.ReadingState.CurrentBookmark?.ProgressPercent}`);
					console.log(`${LOG_PREFIX}   - ReadingState.Status: ${ent.ChangedEntitlement.ReadingState.StatusInfo?.Status}`);
				}
			} else if ('ChangedReadingState' in ent) {
				console.log(`${LOG_PREFIX} Entitlement[${i}]: ChangedReadingState`);
				console.log(`${LOG_PREFIX}   - ProgressPercent: ${ent.ChangedReadingState.ReadingState.CurrentBookmark?.ProgressPercent}`);
			} else {
				console.log(`${LOG_PREFIX} Entitlement[${i}]: Unknown type`);
			}
		}

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

			console.log(`${LOG_PREFIX} Marking books as synced:`, syncedBookIds);
			if (syncedBookIds.length > 0) {
				await markBooksSynced(userId, syncedBookIds);
				console.log(`${LOG_PREFIX} Successfully marked ${syncedBookIds.length} books as synced`);
			}
		}

		// Check if there are more new books
		const moreNewBooks = await getUnsyncedBooks(userId, 1);
		console.log(`${LOG_PREFIX} More new books remaining:`, moreNewBooks.length > 0);
		if (moreNewBooks.length > 0) {
			shouldContinue = true;
		}
	} else {
		console.log(`${LOG_PREFIX} No unsynced books found`);
	}

	// If we have slots remaining, handle changed reading states (web reader -> device sync)
	// Use ChangedEntitlement with ReadingState instead of ChangedReadingState for better device compatibility
	if (remainingSlots > 0 && !shouldContinue) {
		console.log(`${LOG_PREFIX} Checking for changed reading states (${remainingSlots} slots remaining)`);
		const changedStates = await getUnsyncedReadingStates(userId, remainingSlots);
		console.log(`${LOG_PREFIX} Changed reading states:`, changedStates.length);

		if (changedStates.length > 0) {
			const readingStateBookIds: number[] = [];
			for (const state of changedStates) {
				// Generate ChangedEntitlement with updated reading state
				// This format is better supported by Kobo devices than ChangedReadingState
				const changedEntitlement = await generateChangedEntitlementWithReadingState(
					userId,
					state.bookId,
					baseUrl,
					token,
					state.progressPercent,
					state.status,
					state.locationValue,
					state.lastModified
				);

				if (changedEntitlement) {
					console.log(`${LOG_PREFIX} ChangedEntitlement (reading state) for book ${state.bookId}:`);
					console.log(`${LOG_PREFIX}   EntitlementId: ${state.entitlementId}`);
					console.log(`${LOG_PREFIX}   Progress: ${state.progressPercent}%`);
					console.log(`${LOG_PREFIX}   Status: ${state.status}`);
					console.log(`${LOG_PREFIX}   Location: ${state.locationValue}`);
					console.log(`${LOG_PREFIX}   LastModified: ${state.lastModified}`);
					console.log(`${LOG_PREFIX}   Full payload:`, JSON.stringify(changedEntitlement, null, 2));
					entitlements.push(changedEntitlement);
					readingStateBookIds.push(state.bookId);
				} else {
					console.log(`${LOG_PREFIX} Failed to generate ChangedEntitlement for book ${state.bookId}`);
				}
			}
			remainingSlots -= readingStateBookIds.length;

			// Mark reading states as synced
			await markReadingStatesSynced(userId, readingStateBookIds);

			// Check if there are more changed states
			const moreChangedStates = await getUnsyncedReadingStates(userId, 1);
			if (moreChangedStates.length > 0) {
				shouldContinue = true;
			}
		}
	}

	// If we have slots remaining, handle removed books
	if (remainingSlots > 0 && !shouldContinue) {
		console.log(`${LOG_PREFIX} Checking for removed books (${remainingSlots} slots remaining)`);
		const removedBookIds = await getRemovedBooks(userId, remainingSlots);
		console.log(`${LOG_PREFIX} Removed book IDs:`, removedBookIds);

		if (removedBookIds.length > 0) {
			const removedEntitlements = await generateEntitlements(
				userId,
				removedBookIds,
				baseUrl,
				token,
				'removed'
			);
			console.log(`${LOG_PREFIX} Generated ${removedEntitlements.length} removed entitlements`);
			entitlements.push(...removedEntitlements);

			// Mark these books as removed
			for (const bookId of removedBookIds) {
				await markBookRemoved(userId, bookId);
			}
			console.log(`${LOG_PREFIX} Marked ${removedBookIds.length} books as removed`);

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

	console.log(`${LOG_PREFIX} ========== syncLibrary END ==========`);
	console.log(`${LOG_PREFIX} Total entitlements: ${entitlements.length}`);
	console.log(`${LOG_PREFIX} shouldContinue: ${shouldContinue}`);
	console.log(`${LOG_PREFIX} newSyncToken:`, JSON.stringify(newSyncToken));

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
