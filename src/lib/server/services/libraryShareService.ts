import { db, libraryShares, users, books, userBooks } from '$lib/server/db';
import { eq, and, or, inArray } from 'drizzle-orm';
import type { LibrarySharePermission } from '$lib/server/db/schema';

export interface LibraryShareInfo {
	id: number;
	ownerId: number;
	sharedWithId: number;
	permission: LibrarySharePermission;
	createdAt: string | null;
	ownerName?: string;
	ownerEmail?: string;
	sharedWithName?: string;
	sharedWithEmail?: string;
}

/**
 * Share a library with another user
 */
export async function shareLibrary(
	ownerId: number,
	sharedWithId: number,
	permission: LibrarySharePermission = 'read'
): Promise<LibraryShareInfo> {
	// Don't allow sharing with self
	if (ownerId === sharedWithId) {
		throw new Error('Cannot share library with yourself');
	}

	// Check if share already exists
	const existing = await db
		.select()
		.from(libraryShares)
		.where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.sharedWithId, sharedWithId)))
		.get();

	if (existing) {
		// Update permission if different
		if (existing.permission !== permission) {
			await db
				.update(libraryShares)
				.set({ permission, updatedAt: new Date().toISOString() })
				.where(eq(libraryShares.id, existing.id));
			return { ...existing, permission };
		}
		return existing as LibraryShareInfo;
	}

	// Create new share
	const result = await db
		.insert(libraryShares)
		.values({
			ownerId,
			sharedWithId,
			permission,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.returning();

	return result[0] as LibraryShareInfo;
}

/**
 * Remove a library share
 */
export async function removeShare(ownerId: number, sharedWithId: number): Promise<boolean> {
	const result = await db
		.delete(libraryShares)
		.where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.sharedWithId, sharedWithId)));

	return result.changes > 0;
}

/**
 * Get all libraries shared with a user (libraries they can access from others)
 */
export async function getSharedLibraries(userId: number): Promise<LibraryShareInfo[]> {
	const shares = await db
		.select({
			id: libraryShares.id,
			ownerId: libraryShares.ownerId,
			sharedWithId: libraryShares.sharedWithId,
			permission: libraryShares.permission,
			createdAt: libraryShares.createdAt,
			ownerUsername: users.username,
			ownerEmail: users.email
		})
		.from(libraryShares)
		.innerJoin(users, eq(libraryShares.ownerId, users.id))
		.where(eq(libraryShares.sharedWithId, userId))
		.all();

	return shares.map((share) => ({
		id: share.id,
		ownerId: share.ownerId,
		sharedWithId: share.sharedWithId,
		permission: share.permission as LibrarySharePermission,
		createdAt: share.createdAt,
		ownerName: share.ownerUsername,
		ownerEmail: share.ownerEmail
	}));
}

/**
 * Get all shares a user has granted to others (who they've shared their library with)
 */
export async function getLibraryShares(ownerId: number): Promise<LibraryShareInfo[]> {
	const shares = await db
		.select({
			id: libraryShares.id,
			ownerId: libraryShares.ownerId,
			sharedWithId: libraryShares.sharedWithId,
			permission: libraryShares.permission,
			createdAt: libraryShares.createdAt,
			sharedWithUsername: users.username,
			sharedWithEmail: users.email
		})
		.from(libraryShares)
		.innerJoin(users, eq(libraryShares.sharedWithId, users.id))
		.where(eq(libraryShares.ownerId, ownerId))
		.all();

	return shares.map((share) => ({
		id: share.id,
		ownerId: share.ownerId,
		sharedWithId: share.sharedWithId,
		permission: share.permission as LibrarySharePermission,
		createdAt: share.createdAt,
		sharedWithName: share.sharedWithUsername,
		sharedWithEmail: share.sharedWithEmail
	}));
}

/**
 * Get the permission level a user has for a specific book
 * Returns null if user has no access, or the permission level
 */
export async function getBookPermission(
	userId: number,
	bookId: number
): Promise<LibrarySharePermission | 'owner' | null> {
	// Get the book's owner
	const book = await db.select({ ownerId: books.ownerId }).from(books).where(eq(books.id, bookId)).get();

	if (!book || book.ownerId === null) {
		return null;
	}

	// If user is the owner, they have full access
	if (book.ownerId === userId) {
		return 'owner';
	}

	// Check if user has shared access
	const share = await db
		.select({ permission: libraryShares.permission })
		.from(libraryShares)
		.where(and(eq(libraryShares.ownerId, book.ownerId!), eq(libraryShares.sharedWithId, userId)))
		.get();

	if (share) {
		return share.permission as LibrarySharePermission;
	}

	return null;
}

/**
 * Check if a user can access a specific book
 * User can access if: book is in their user_books, they own it, or it was shared with them
 */
export async function canAccessBook(userId: number, bookId: number): Promise<boolean> {
	// First check if book is in user's personal library (user_books)
	const userBook = await db
		.select({ id: userBooks.id })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.get();

	if (userBook) {
		return true;
	}

	// Fall back to ownership/sharing check
	const permission = await getBookPermission(userId, bookId);
	return permission !== null;
}

/**
 * Check if a user can modify a specific book (requires read_write or full permission, or ownership)
 */
export async function canModifyBook(userId: number, bookId: number): Promise<boolean> {
	const permission = await getBookPermission(userId, bookId);
	return permission === 'owner' || permission === 'read_write' || permission === 'full';
}

/**
 * Check if a user can delete a specific book (requires full permission or ownership)
 */
export async function canDeleteBook(userId: number, bookId: number): Promise<boolean> {
	const permission = await getBookPermission(userId, bookId);
	return permission === 'owner' || permission === 'full';
}

/**
 * Get all owner IDs whose books a user can access (including their own)
 */
export async function getAccessibleBookOwners(userId: number): Promise<number[]> {
	// User's own ID is always accessible
	const ownerIds = [userId];

	// Get all libraries shared with this user
	const shares = await db
		.select({ ownerId: libraryShares.ownerId })
		.from(libraryShares)
		.where(eq(libraryShares.sharedWithId, userId))
		.all();

	for (const share of shares) {
		if (!ownerIds.includes(share.ownerId)) {
			ownerIds.push(share.ownerId);
		}
	}

	return ownerIds;
}

/**
 * Get share info between two specific users (if exists)
 */
export async function getShareBetweenUsers(
	ownerId: number,
	sharedWithId: number
): Promise<LibraryShareInfo | null> {
	const share = await db
		.select()
		.from(libraryShares)
		.where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.sharedWithId, sharedWithId)))
		.get();

	return share as LibraryShareInfo | null;
}

/**
 * Update the permission level for an existing share
 */
export async function updateSharePermission(
	ownerId: number,
	sharedWithId: number,
	permission: LibrarySharePermission
): Promise<boolean> {
	const result = await db
		.update(libraryShares)
		.set({ permission, updatedAt: new Date().toISOString() })
		.where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.sharedWithId, sharedWithId)));

	return result.changes > 0;
}

/**
 * Get all users who could be shared with (all users except self)
 */
export async function getShareableUsers(currentUserId: number): Promise<{ id: number; username: string; email: string }[]> {
	const allUsers = await db
		.select({
			id: users.id,
			username: users.username,
			email: users.email
		})
		.from(users)
		.where(and(
			// Exclude current user
			eq(users.id, currentUserId) ? undefined : undefined
		))
		.all();

	// Filter out current user
	return allUsers.filter((u) => u.id !== currentUserId);
}
