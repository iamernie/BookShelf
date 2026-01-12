/**
 * Kobo Reading State Service
 *
 * Manages reading progress sync between Kobo devices and BookShelf.
 */

import { db } from '$lib/server/db';
import { koboReadingState, koboSyncState, books, userBooks } from '$lib/server/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { parseReadingProgress, stringifyReadingProgress, type ReadingProgress } from './ebookService';

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
	PriorityTimestamp?: string;
	CurrentBookmark: {
		ProgressPercent: number;
		ContentSourceProgressPercent?: number;
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
		TimesStartedReading?: number;
		LastTimeStartedReading?: string;
		LastTimeFinished?: string;
	};
	Statistics: {
		SpentReadingMinutes: number;
		RemainingTimeMinutes?: number;
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
	// Get the book - allow unowned books for single-user setups
	const book = await db.query.books.findFirst({
		where: eq(books.id, bookId)
	});

	if (!book) {
		return null;
	}

	// Check ownership - allow if owned by user or unowned (null)
	if (book.ownerId !== null && book.ownerId !== userId) {
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

	// Calculate progress percent from various sources (priority: koboReadingState > books.readingProgress > userBooks)
	let progressPercent = 0;
	let status: 'ReadyToRead' | 'Reading' | 'Finished' = 'ReadyToRead';
	let locationValue = '';

	if (state) {
		// Use Kobo reading state (from device)
		progressPercent = state.progressPercent || 0;
		status = (state.status as 'ReadyToRead' | 'Reading' | 'Finished') || 'ReadyToRead';
		locationValue = state.locationValue || '';
	} else if (book.readingProgress) {
		// Fall back to book.readingProgress (from web reader)
		const bookProgress = parseReadingProgress(book.readingProgress);
		if (bookProgress) {
			progressPercent = bookProgress.percentage || 0;
			locationValue = bookProgress.location || '';
		}
	} else if (userBook) {
		// Final fallback to userBook progress
		progressPercent = userBook.readingProgress || 0;
	}

	// Derive status from progress if not from state
	if (!state) {
		if (progressPercent >= 99) {
			status = 'Finished';
		} else if (progressPercent > 0) {
			status = 'Reading';
		}
	}

	const lastModified = state?.lastModified || book.lastReadAt || now;
	const timesStartedReading = status === 'ReadyToRead' ? 0 : 1;

	return {
		EntitlementId: entitlementId,
		Created: book.createdAt || now,
		LastModified: lastModified,
		CurrentBookmark: {
			ProgressPercent: Math.round(progressPercent),
			Location: {
				Value: locationValue,
				Type: 'KoboSpan',
				Source: 'BookShelf'
			},
			LastModified: lastModified
		},
		StatusInfo: {
			Status: status,
			LastModified: lastModified,
			TimesStartedReading: timesStartedReading
		},
		Statistics: {
			SpentReadingMinutes: state?.spentReadingMinutes || 0,
			LastModified: lastModified
		}
	};
}

export interface SaveReadingStateResult {
	EntitlementId: string;
	CurrentBookmarkResult: { Result: string };
	StatisticsResult: { Result: string };
	StatusInfoResult: { Result: string };
}

/**
 * Save reading state from Kobo device
 */
export async function saveReadingState(
	userId: number,
	bookId: number,
	state: KoboReadingStateUpdate
): Promise<SaveReadingStateResult> {
	console.log(`[Kobo ReadingState] saveReadingState for book ${bookId}:`, JSON.stringify(state, null, 2));

	// Get the book - allow unowned books for single-user setups
	const book = await db.query.books.findFirst({
		where: eq(books.id, bookId)
	});

	if (!book) {
		return {
			EntitlementId: `bookshelf-${bookId}`,
			CurrentBookmarkResult: { Result: 'NotFound' },
			StatisticsResult: { Result: 'NotFound' },
			StatusInfoResult: { Result: 'NotFound' }
		};
	}

	// Check ownership - allow if owned by user or unowned (null)
	if (book.ownerId !== null && book.ownerId !== userId) {
		return {
			EntitlementId: `bookshelf-${bookId}`,
			CurrentBookmarkResult: { Result: 'NotFound' },
			StatisticsResult: { Result: 'NotFound' },
			StatusInfoResult: { Result: 'NotFound' }
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
	const locationValue = state.CurrentBookmark?.Location?.Value || null;

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
				locationValue,
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
			locationValue,
			lastModified: now,
			deviceData,
			createdAt: now,
			updatedAt: now
		});
	}

	// Also update userBooks progress
	await syncToUserBooks(userId, bookId, progressPercent, status);

	// Sync to books.readingProgress for web reader integration
	await syncToBooksTable(bookId, progressPercent, state.CurrentBookmark?.Location);

	console.log(`[Kobo ReadingState] Saved progress for book ${bookId}: ${progressPercent}%, status: ${status}`);

	return {
		EntitlementId: entitlementId,
		CurrentBookmarkResult: { Result: 'Success' },
		StatisticsResult: { Result: 'Success' },
		StatusInfoResult: { Result: 'Success' }
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
 * Sync Kobo reading state to books table (for web reader integration)
 */
async function syncToBooksTable(
	bookId: number,
	progressPercent: number,
	location?: { Value?: string; Type?: string; Source?: string }
): Promise<void> {
	const now = new Date().toISOString();

	// Build reading progress object compatible with web reader
	const progress: ReadingProgress = {
		location: location?.Value || '',
		percentage: progressPercent,
		savedAt: now
	};

	await db
		.update(books)
		.set({
			readingProgress: stringifyReadingProgress(progress),
			lastReadAt: now,
			updatedAt: now
		})
		.where(eq(books.id, bookId));
}

/**
 * Sync web reader progress to Kobo reading state
 * Called when the web reader saves progress
 */
export async function syncFromWebReader(
	userId: number,
	bookId: number,
	progressPercent: number,
	location?: string
): Promise<{ synced: boolean; reason: string }> {
	const now = new Date().toISOString();

	// Check if book is tagged for Kobo sync
	const syncState = await db.query.koboSyncState.findFirst({
		where: and(eq(koboSyncState.userId, userId), eq(koboSyncState.bookId, bookId))
	});

	if (!syncState) {
		return { synced: false, reason: 'not_kobo_synced' };
	}

	// Determine status from progress
	let status: string = 'ReadyToRead';
	if (progressPercent >= 99) {
		status = 'Finished';
	} else if (progressPercent > 0) {
		status = 'Reading';
	}

	// Check for existing state
	const existingState = await db.query.koboReadingState.findFirst({
		where: and(eq(koboReadingState.userId, userId), eq(koboReadingState.bookId, bookId))
	});

	// Don't regress progress - if new percentage is 0 or lower than existing, skip update
	// This prevents race conditions from multiple save calls overwriting real progress
	if (existingState && existingState.progressPercent && progressPercent < existingState.progressPercent) {
		console.log(`[Kobo ReadingState] Skipping regression for book ${bookId}: ${progressPercent}% < ${existingState.progressPercent}%`);
		return { synced: false, reason: 'no_regression' };
	}

	const deviceData = JSON.stringify({
		location: location ? { Value: location, Type: 'KoboSpan', Source: 'BookShelf' } : null
	});

	if (existingState) {
		await db
			.update(koboReadingState)
			.set({
				progressPercent,
				status,
				locationValue: location,
				lastModified: now,
				deviceData,
				updatedAt: now
			})
			.where(eq(koboReadingState.id, existingState.id));
	} else {
		await db.insert(koboReadingState).values({
			userId,
			bookId,
			entitlementId: syncState.entitlementId,
			progressPercent,
			status,
			locationValue: location,
			lastModified: now,
			deviceData,
			createdAt: now,
			updatedAt: now
		});
	}

	console.log(`[Kobo ReadingState] Synced from web reader for book ${bookId}: ${progressPercent}%`);
	return { synced: true, reason: 'success' };
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
