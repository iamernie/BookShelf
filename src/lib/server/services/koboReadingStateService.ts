/**
 * Kobo Reading State Service
 *
 * Manages reading progress sync between Kobo devices and BookShelf.
 */

import { db } from '$lib/server/db';
import { koboReadingState, koboSyncState, books, userBooks } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// Types for Kobo reading state
export interface KoboReadingStateUpdate {
	EntitlementId?: string;
	CurrentBookmark?: {
		ProgressPercent?: number;
		Location?: {
			Value?: string;
			Type?: string;
			Source?: string;
		};
		LastModified?: string;
	};
	StatusInfo?: {
		Status?: 'ReadyToRead' | 'Reading' | 'Finished';
		LastModified?: string;
	};
	Statistics?: {
		SpentReadingMinutes?: number;
		LastModified?: string;
	};
}

export interface KoboReadingStateResponse {
	EntitlementId: string;
	Created: string;
	LastModified: string;
	PriorityTimestamp: string;
	CurrentBookmark: {
		ProgressPercent: number;
		Location: {
			Value: string;
			Type: string;
			Source: string;
		};
		LastModified: string;
	};
	StatusInfo: {
		Status: string;
		LastModified: string;
	};
	Statistics: {
		SpentReadingMinutes: number;
		LastModified: string;
	};
}

/**
 * Get reading state for a book
 */
export async function getReadingState(
	userId: number,
	bookId: number
): Promise<KoboReadingStateResponse | null> {
	// Get the book for entitlement ID
	const book = await db.query.books.findFirst({
		where: and(eq(books.id, bookId), eq(books.ownerId, userId))
	});

	if (!book) {
		return null;
	}

	// Get existing Kobo reading state
	const state = await db.query.koboReadingState.findFirst({
		where: and(eq(koboReadingState.userId, userId), eq(koboReadingState.bookId, bookId))
	});

	// Get user book for progress data
	const userBook = await db.query.userBooks.findFirst({
		where: and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))
	});

	const now = new Date().toISOString();

	// Get entitlement ID from sync state
	const syncState = await db.query.koboSyncState.findFirst({
		where: and(eq(koboSyncState.userId, userId), eq(koboSyncState.bookId, bookId))
	});
	const entitlementId = syncState?.entitlementId || `bookshelf-${bookId}`;

	// Calculate progress percent from various sources
	let progressPercent = 0;
	let status: 'ReadyToRead' | 'Reading' | 'Finished' = 'ReadyToRead';

	if (state) {
		progressPercent = state.progressPercent || 0;
		status = (state.status as 'ReadyToRead' | 'Reading' | 'Finished') || 'ReadyToRead';
	} else if (userBook) {
		// Fall back to userBook progress
		progressPercent = userBook.readingProgress || 0;
		if (progressPercent >= 100) {
			status = 'Finished';
		} else if (progressPercent > 0) {
			status = 'Reading';
		}
	}

	const lastModified = state?.lastModified || now;

	return {
		EntitlementId: entitlementId,
		Created: book.createdAt || now,
		LastModified: lastModified,
		PriorityTimestamp: lastModified,
		CurrentBookmark: {
			ProgressPercent: progressPercent,
			Location: {
				Value: '',
				Type: 'KoboSpan',
				Source: 'BookShelf'
			},
			LastModified: lastModified
		},
		StatusInfo: {
			Status: status,
			LastModified: lastModified
		},
		Statistics: {
			SpentReadingMinutes: 0,
			LastModified: lastModified
		}
	};
}

/**
 * Save reading state from Kobo device
 */
export async function saveReadingState(
	userId: number,
	bookId: number,
	state: KoboReadingStateUpdate
): Promise<{ EntitlementId: string; CurrentBookmarkResult: { Result: string } }> {
	// Get the book
	const book = await db.query.books.findFirst({
		where: and(eq(books.id, bookId), eq(books.ownerId, userId))
	});

	if (!book) {
		return {
			EntitlementId: `bookshelf-${bookId}`,
			CurrentBookmarkResult: { Result: 'NotFound' }
		};
	}

	// Get entitlement ID from sync state
	const syncState = await db.query.koboSyncState.findFirst({
		where: and(eq(koboSyncState.userId, userId), eq(koboSyncState.bookId, bookId))
	});
	const entitlementId = syncState?.entitlementId || `bookshelf-${bookId}`;
	const now = new Date().toISOString();

	// Extract progress data
	const progressPercent = state.CurrentBookmark?.ProgressPercent ?? 0;
	const status = state.StatusInfo?.Status || 'ReadyToRead';

	// Check for existing state
	const existingState = await db.query.koboReadingState.findFirst({
		where: and(eq(koboReadingState.userId, userId), eq(koboReadingState.bookId, bookId))
	});

	// Store device data as JSON
	const deviceData = JSON.stringify({
		location: state.CurrentBookmark?.Location,
		statistics: state.Statistics
	});

	if (existingState) {
		// Update existing state
		await db
			.update(koboReadingState)
			.set({
				progressPercent,
				status,
				lastModified: now,
				deviceData
			})
			.where(eq(koboReadingState.id, existingState.id));
	} else {
		// Create new state
		await db.insert(koboReadingState).values({
			userId,
			bookId,
			entitlementId,
			progressPercent,
			status,
			lastModified: now,
			deviceData,
			createdAt: now,
			updatedAt: now
		});
	}

	// Also update userBooks progress
	await syncToUserBooks(userId, bookId, progressPercent, status);

	return {
		EntitlementId: entitlementId,
		CurrentBookmarkResult: { Result: 'Success' }
	};
}

/**
 * Sync Kobo reading state to userBooks table
 */
async function syncToUserBooks(
	userId: number,
	bookId: number,
	progressPercent: number,
	_status: string
): Promise<void> {
	const now = new Date().toISOString();
	const existingUserBook = await db.query.userBooks.findFirst({
		where: and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))
	});

	if (existingUserBook) {
		// Update progress
		await db
			.update(userBooks)
			.set({
				readingProgress: progressPercent,
				lastReadAt: now,
				updatedAt: now
			})
			.where(eq(userBooks.id, existingUserBook.id));
	} else {
		// Create userBook entry
		await db.insert(userBooks).values({
			userId,
			bookId,
			readingProgress: progressPercent,
			lastReadAt: now,
			createdAt: now,
			updatedAt: now
		});
	}
}

/**
 * Generate reading state for entitlement response
 */
export function generateReadingStateForEntitlement(
	book: { id: number; koboEntitlementId?: string | null; createdAt?: string | null },
	progressPercent: number = 0,
	status: 'ReadyToRead' | 'Reading' | 'Finished' = 'ReadyToRead'
): KoboReadingStateResponse {
	const now = new Date().toISOString();
	const entitlementId = book.koboEntitlementId || `bookshelf-${book.id}`;

	return {
		EntitlementId: entitlementId,
		Created: book.createdAt || now,
		LastModified: now,
		PriorityTimestamp: now,
		CurrentBookmark: {
			ProgressPercent: progressPercent,
			Location: {
				Value: '',
				Type: 'KoboSpan',
				Source: 'BookShelf'
			},
			LastModified: now
		},
		StatusInfo: {
			Status: status,
			LastModified: now
		},
		Statistics: {
			SpentReadingMinutes: 0,
			LastModified: now
		}
	};
}
