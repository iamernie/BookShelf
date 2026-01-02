/**
 * Media Source Service
 *
 * Manages media sources (where books were purchased) and book-media source associations.
 */

import { db } from '$lib/server/db';
import { mediaSources, bookMediaSources } from '$lib/server/db/schema';
import type { MediaSource, NewMediaSource, BookMediaSource, NewBookMediaSource } from '$lib/server/db/schema';
import { eq, asc, and, or, isNull } from 'drizzle-orm';

// ============================================
// Media Sources CRUD
// ============================================

/**
 * Get all media sources visible to a user
 * - System sources (isSystem=true, userId=null) are visible to everyone
 * - User-created sources (userId set) are only visible to their owner
 * @param userId - The user ID to filter by (optional, for user-specific sources)
 */
export async function getAllMediaSources(userId?: number): Promise<MediaSource[]> {
	if (userId) {
		// Return system sources + user's own sources
		return db
			.select()
			.from(mediaSources)
			.where(
				or(
					eq(mediaSources.isSystem, true),
					isNull(mediaSources.userId), // Legacy sources without userId are treated as system
					eq(mediaSources.userId, userId)
				)
			)
			.orderBy(asc(mediaSources.displayOrder), asc(mediaSources.name));
	}
	// No userId filter - return all (for admin purposes)
	return db
		.select()
		.from(mediaSources)
		.orderBy(asc(mediaSources.displayOrder), asc(mediaSources.name));
}

/**
 * Get a media source by ID
 */
export async function getMediaSourceById(id: number): Promise<MediaSource | undefined> {
	const [source] = await db
		.select()
		.from(mediaSources)
		.where(eq(mediaSources.id, id))
		.limit(1);
	return source;
}

/**
 * Create a new media source
 * @param data - The media source data
 * @param userId - If provided, this becomes a user-private source
 */
export async function createMediaSource(
	data: Omit<NewMediaSource, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
	userId?: number
): Promise<MediaSource> {
	const now = new Date().toISOString();
	const [source] = await db
		.insert(mediaSources)
		.values({
			...data,
			userId: userId || null, // null = system-wide, userId = private
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return source;
}

/**
 * Update a media source
 */
export async function updateMediaSource(id: number, data: Partial<Omit<NewMediaSource, 'id' | 'createdAt'>>): Promise<MediaSource | undefined> {
	const now = new Date().toISOString();
	const [source] = await db
		.update(mediaSources)
		.set({
			...data,
			updatedAt: now
		})
		.where(eq(mediaSources.id, id))
		.returning();
	return source;
}

/**
 * Delete a media source
 * - System sources cannot be deleted
 * - User sources can only be deleted by their owner or admins
 * @param id - The media source ID
 * @param userId - The requesting user's ID (for permission check)
 * @param isAdmin - Whether the user is an admin
 */
export async function deleteMediaSource(id: number, userId?: number, isAdmin?: boolean): Promise<boolean> {
	const source = await getMediaSourceById(id);
	if (!source) {
		return false;
	}

	// System sources cannot be deleted
	if (source.isSystem) {
		return false;
	}

	// Non-admins can only delete their own sources
	if (!isAdmin && source.userId !== userId) {
		return false;
	}

	await db.delete(mediaSources).where(eq(mediaSources.id, id));
	return true;
}

// ============================================
// Book-Media Source Associations
// ============================================

export interface BookMediaSourceWithDetails extends BookMediaSource {
	mediaSource: MediaSource;
}

/**
 * Get all media sources for a book
 */
export async function getBookMediaSources(bookId: number): Promise<BookMediaSourceWithDetails[]> {
	const results = await db
		.select({
			bookMediaSource: bookMediaSources,
			mediaSource: mediaSources
		})
		.from(bookMediaSources)
		.innerJoin(mediaSources, eq(bookMediaSources.mediaSourceId, mediaSources.id))
		.where(eq(bookMediaSources.bookId, bookId))
		.orderBy(asc(mediaSources.displayOrder), asc(mediaSources.name));

	return results.map(r => ({
		...r.bookMediaSource,
		mediaSource: r.mediaSource
	}));
}

/**
 * Add a media source to a book
 */
export async function addBookMediaSource(
	bookId: number,
	mediaSourceId: number,
	data?: {
		purchaseDate?: string;
		purchasePrice?: number;
		externalUrl?: string;
		externalId?: string;
		notes?: string;
	}
): Promise<BookMediaSource> {
	const now = new Date().toISOString();
	const [entry] = await db
		.insert(bookMediaSources)
		.values({
			bookId,
			mediaSourceId,
			purchaseDate: data?.purchaseDate,
			purchasePrice: data?.purchasePrice,
			externalUrl: data?.externalUrl,
			externalId: data?.externalId,
			notes: data?.notes,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return entry;
}

/**
 * Update a book-media source association
 */
export async function updateBookMediaSource(
	id: number,
	data: {
		purchaseDate?: string | null;
		purchasePrice?: number | null;
		externalUrl?: string | null;
		externalId?: string | null;
		notes?: string | null;
	}
): Promise<BookMediaSource | undefined> {
	const now = new Date().toISOString();
	const [entry] = await db
		.update(bookMediaSources)
		.set({
			...data,
			updatedAt: now
		})
		.where(eq(bookMediaSources.id, id))
		.returning();
	return entry;
}

/**
 * Remove a media source from a book
 */
export async function removeBookMediaSource(bookId: number, mediaSourceId: number): Promise<boolean> {
	const result = await db
		.delete(bookMediaSources)
		.where(
			and(
				eq(bookMediaSources.bookId, bookId),
				eq(bookMediaSources.mediaSourceId, mediaSourceId)
			)
		);
	return true;
}

/**
 * Remove a book-media source association by ID
 */
export async function removeBookMediaSourceById(id: number): Promise<boolean> {
	await db.delete(bookMediaSources).where(eq(bookMediaSources.id, id));
	return true;
}

/**
 * Set all media sources for a book (replaces existing)
 */
export async function setBookMediaSources(
	bookId: number,
	sources: Array<{
		mediaSourceId: number;
		purchaseDate?: string;
		purchasePrice?: number;
		externalUrl?: string;
		externalId?: string;
		notes?: string;
	}>
): Promise<BookMediaSourceWithDetails[]> {
	// Delete existing associations
	await db.delete(bookMediaSources).where(eq(bookMediaSources.bookId, bookId));

	// Add new associations
	const now = new Date().toISOString();
	if (sources.length > 0) {
		await db.insert(bookMediaSources).values(
			sources.map(s => ({
				bookId,
				mediaSourceId: s.mediaSourceId,
				purchaseDate: s.purchaseDate,
				purchasePrice: s.purchasePrice,
				externalUrl: s.externalUrl,
				externalId: s.externalId,
				notes: s.notes,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Return updated list
	return getBookMediaSources(bookId);
}
