import { db, libraryShares, users, books, userBooks } from '$lib/server/db';
import { eq, and, or, inArray, sql, type SQL } from 'drizzle-orm';
import type { LibrarySharePermission } from '$lib/server/db/schema';
import { hasPermission, isLibrarianOrAbove, Permission } from '$lib/server/services/permissionService';

/** Who is looking: the role decides the catalog-manager branch, the id everything else */
export type Viewer = { id: number; role: string | null } | null | undefined;

export type EntityKind = 'series' | 'author' | 'narrator';

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
 * Check if a user can reach a book: ownerless and public books are open to everyone, anything
 * else needs ownership, an active share, or the book being in the user's own library (a
 * user_books row). Membership is permanent reach: a book someone added while it was public stays
 * theirs after it is un-promoted, and a share recipient who added a shared book keeps it (2.30.0).
 * Ownerless is checked here and not in getBookPermission because bulk imports have no owner and
 * are still the library's own books. Reach never grants catalog edits, nor reading: see holdsBook.
 */
export async function canReachBook(userId: number, bookId: number): Promise<boolean> {
	const book = await db
		.select({ ownerId: books.ownerId, libraryType: books.libraryType })
		.from(books)
		.where(eq(books.id, bookId))
		.get();

	if (!book) {
		return false;
	}

	if (book.ownerId === null || book.libraryType === 'public') {
		return true;
	}

	if ((await getBookPermission(userId, bookId)) !== null) {
		return true;
	}

	const member = await db
		.select({ id: userBooks.id })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.get();
	return !!member;
}

/**
 * Check if a viewer can see a book: canReachBook, plus every book for admins and librarians (the
 * catalog managers). Only viewing uses this (the book page, GET /api/books/[id], entity pages);
 * Add, reading and the edit paths stay on the role-blind canReachBook, so a manager can look at a
 * member's private book but never take it into their own library. SQL twin: reachableBookCond.
 */
export async function canViewBook(viewer: Viewer, bookId: number): Promise<boolean> {
	if (!viewer) return false;
	if (isLibrarianOrAbove(viewer)) {
		const book = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId)).get();
		return !!book;
	}
	return canReachBook(viewer.id, bookId);
}

/**
 * Row-level book reach on the books table aliased `alias`, the SQL twin of canViewBook: nothing
 * without a viewer, everything for admins and librarians, otherwise canReachBook's clauses
 * (ownerless, public, own, shared with the viewer, or in their library). The alias is spliced
 * raw, so it must always be a constant from the calling code, never request input. A caller
 * wanting canReachBook's role-blind set passes the viewer with role 'member'.
 */
export function reachableBookCond(viewer: Viewer, alias = 'books'): SQL {
	if (!viewer) return sql`1=0`;
	if (isLibrarianOrAbove(viewer)) return sql`1=1`;
	const a = sql.raw(alias);
	return sql`(${a}.ownerId IS NULL OR ${a}.libraryType = 'public' OR ${a}.ownerId = ${viewer.id}
		OR ${a}.ownerId IN (SELECT ownerId FROM library_shares WHERE sharedWithId = ${viewer.id})
		OR ${a}.id IN (SELECT bookId FROM user_books WHERE userId = ${viewer.id}))`;
}

/**
 * Entity gate: the series, author or narrator with id `idExpr` touches at least one book the
 * viewer can see (series by bookseries, authors by bookauthors, narrators by books.narratorId).
 * Admins and librarians pass for every entity, books or not. Inner aliases are e-prefixed so they
 * never shadow the caller's.
 */
export function reachableEntityCond(viewer: Viewer, kind: EntityKind, idExpr: SQL): SQL {
	if (!viewer) return sql`1=0`;
	if (isLibrarianOrAbove(viewer)) return sql`1=1`;
	const reach = reachableBookCond(viewer, 'eb');
	switch (kind) {
		case 'series':
			return sql`EXISTS (SELECT 1 FROM bookseries ebs JOIN books eb ON eb.id = ebs.bookId WHERE ebs.seriesId = ${idExpr} AND ${reach})`;
		case 'author':
			return sql`EXISTS (SELECT 1 FROM bookauthors eba JOIN books eb ON eb.id = eba.bookId WHERE eba.authorId = ${idExpr} AND ${reach})`;
		case 'narrator':
			return sql`EXISTS (SELECT 1 FROM books eb WHERE eb.narratorId = ${idExpr} AND ${reach})`;
	}
}

const ENTITY_TABLES: Record<EntityKind, string> = { series: 'series', author: 'authors', narrator: 'narrators' };

/** The entity exists and passes reachableEntityCond: detail pages and their APIs 404 otherwise */
export async function canReachEntity(viewer: Viewer, kind: EntityKind, id: number): Promise<boolean> {
	if (!viewer || !Number.isSafeInteger(id)) return false;
	const table = sql.raw(ENTITY_TABLES[kind]);
	const row = await db.get<{ ok: number }>(
		sql`SELECT 1 AS ok FROM ${table} WHERE ${table}.id = ${id} AND ${reachableEntityCond(viewer, kind, sql`${table}.id`)}`
	);
	return !!row;
}

/**
 * Check if a book is in the user's library: their own user_books row, or they own it (creators
 * write their row with the book; ownership still counts if it went missing). Reading needs this,
 * not just reach (2.30.0): a reachable book is seen and Added first, and only then read, on the
 * web, KOReader or Kobo. A row is permanent reach, so a held book is always reachable too.
 */
export async function holdsBook(userId: number, bookId: number): Promise<boolean> {
	const book = await db
		.select({ ownerId: books.ownerId, member: userBooks.id })
		.from(books)
		.leftJoin(userBooks, and(eq(userBooks.bookId, books.id), eq(userBooks.userId, userId)))
		.where(eq(books.id, bookId))
		.get();
	return !!book && (book.member !== null || book.ownerId === userId);
}

/**
 * Check if a user can read a book's ebook file or reader progress: the role allows reading and
 * the book is in their library
 */
export async function canReadEbook(user: { id: number; role: string | null }, bookId: number): Promise<boolean> {
	return hasPermission(user, Permission.READ_EBOOKS) && holdsBook(user.id, bookId);
}

/**
 * SQL twin of canReadEbook over books aliased `alias`: the viewer's own library (a user_books row
 * or ownership), every role alike, and nothing without the read-ebooks permission. E-readers see
 * only this.
 */
export function readableBookCond(viewer: Viewer, alias = 'books'): SQL {
	if (!viewer || !hasPermission(viewer, Permission.READ_EBOOKS)) return sql`1=0`;
	const a = sql.raw(alias);
	return sql`(${a}.ownerId = ${viewer.id} OR ${a}.id IN (SELECT bookId FROM user_books WHERE userId = ${viewer.id}))`;
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

/**
 * "Shared by" for public books (2.30.0): a promoted book keeps its owner, and only admins are told
 * who that is. Returns the owner's username by book id for an admin viewer, and nothing at all for
 * anyone else, so the name never leaves the server for members.
 */
export async function sharedByForViewer(
	viewer: { role: string | null } | null | undefined,
	list: { id: number; ownerId: number | null; libraryType: string | null }[]
): Promise<Map<number, string>> {
	const result = new Map<number, string>();
	if (viewer?.role !== 'admin') return result;
	const owned = list.filter((b) => b.libraryType === 'public' && b.ownerId !== null);
	if (owned.length === 0) return result;
	const ownerIds = [...new Set(owned.map((b) => b.ownerId!))];
	const names = await db
		.select({ id: users.id, username: users.username })
		.from(users)
		.where(inArray(users.id, ownerIds))
		.all();
	const byId = new Map(names.map((u) => [u.id, u.username]));
	for (const b of owned) {
		const name = byId.get(b.ownerId!);
		if (name) result.set(b.id, name);
	}
	return result;
}

/** A public book's owner is admin-only: everyone else but the owner gets the book without it */
export function hideOwnerFrom<T extends { ownerId: number | null; libraryType: string | null }>(
	viewer: { id: number; role: string | null } | null | undefined,
	book: T
): T {
	if (book.libraryType !== 'public' || book.ownerId === null) return book;
	if (viewer?.role === 'admin' || viewer?.id === book.ownerId) return book;
	return { ...book, ownerId: null };
}
