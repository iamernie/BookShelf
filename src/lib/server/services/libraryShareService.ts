import { db, libraryShares, users, books, userBooks, bookSeries, bookAuthors } from '$lib/server/db';
import { eq, and, or, inArray, sql, type SQL } from 'drizzle-orm';
import type { LibrarySharePermission } from '$lib/server/db/schema';
import { getSettingAs } from '$lib/server/services/settingsService';
import { canManagePublicLibrary, hasPermission, isAdmin, isLibrarianOrAbove, Permission } from '$lib/server/services/permissionService';

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

/** Every book in the series, author or narrator (series by bookseries, authors by bookauthors, narrators by books.narratorId) */
function entityBooksCond(kind: EntityKind, id: number): SQL {
	switch (kind) {
		case 'series':
			return inArray(books.id, db.select({ id: bookSeries.bookId }).from(bookSeries).where(eq(bookSeries.seriesId, id)));
		case 'author':
			return inArray(books.id, db.select({ id: bookAuthors.bookId }).from(bookAuthors).where(eq(bookAuthors.authorId, id)));
		case 'narrator':
			return eq(books.narratorId, id);
	}
}

const isPublicBook = sql<number>`COALESCE(${books.libraryType}, 'personal') = 'public'`;

type EntityBook = { id: number; ownerId: number | null; public: number };

function entityBooks(tx: Pick<typeof db, 'select'>, kind: EntityKind, id: number): EntityBook[] {
	return tx
		.select({ id: books.id, ownerId: books.ownerId, public: isPublicBook })
		.from(books)
		.where(entityBooksCond(kind, id))
		.all();
}

/** Admins see the whole split; anyone else only their own count (a skip count would reveal others' private books) */
export type EntityPromoteResult = { promoted: number; alreadyPublic?: number; skipped?: number };

/**
 * Share every book in a series, author or narrator to the public library: the bulk form of the
 * single-book promote (PATCH /api/books/[id]/library), with the same per-book rule. An admin
 * promotes every personal book, ownerless ones included; anyone else only the books they own,
 * other users' books being left alone and never counted for them. Unlike the single-book button
 * there is no content rule: every book goes, with or without an ebook or Audiobookshelf link. One
 * transaction sets libraryType and updatedAt; owners are kept and no user_books row is touched.
 * dryRun selects the same books and writes nothing.
 */
export async function promoteEntityBooks(
	viewer: Viewer,
	kind: EntityKind,
	id: number,
	opts: { dryRun?: boolean } = {}
): Promise<EntityPromoteResult> {
	if (!viewer) return { promoted: 0 };
	const admin = isAdmin(viewer);
	const plan = (tx: Pick<typeof db, 'select'>) => {
		const all = entityBooks(tx, kind, id);
		const personal = all.filter((b) => !b.public);
		const promote = personal.filter((b) => admin || b.ownerId === viewer.id).map((b) => b.id);
		return { promote, alreadyPublic: all.length - personal.length, skipped: personal.length - promote.length };
	};
	const result = opts.dryRun
		? plan(db)
		: db.transaction((tx) => {
				const p = plan(tx);
				if (p.promote.length > 0) {
					tx.update(books)
						.set({ libraryType: 'public', updatedAt: new Date().toISOString() })
						.where(inArray(books.id, p.promote))
						.run();
				}
				return p;
			});
	if (!admin) return { promoted: result.promote.length };
	return { promoted: result.promote.length, alreadyPublic: result.alreadyPublic, skipped: result.skipped };
}

/**
 * Un-share a series, author or narrator (admins only; null for anyone else): every public book in
 * it goes back to personal in one transaction, owners kept, personal books never touched. No
 * user_books row is created or deleted, so members who added a book keep it (permanent reach,
 * 2.30.0); only members without a row lose sight of it. dryRun counts without writing.
 */
export async function unshareEntityBooks(
	viewer: Viewer,
	kind: EntityKind,
	id: number,
	opts: { dryRun?: boolean } = {}
): Promise<{ unshared: number; alreadyPersonal: number } | null> {
	if (!viewer || !isAdmin(viewer)) return null;
	const plan = (tx: Pick<typeof db, 'select'>) => {
		const all = entityBooks(tx, kind, id);
		const unshare = all.filter((b) => b.public).map((b) => b.id);
		return { unshare, alreadyPersonal: all.length - unshare.length };
	};
	const result = opts.dryRun
		? plan(db)
		: db.transaction((tx) => {
				const p = plan(tx);
				if (p.unshare.length > 0) {
					tx.update(books)
						.set({ libraryType: 'personal', updatedAt: new Date().toISOString() })
						.where(inArray(books.id, p.unshare))
						.run();
				}
				return p;
			});
	return { unshared: result.unshare.length, alreadyPersonal: result.alreadyPersonal };
}

/**
 * The detail pages' share buttons: the public library setting (both buttons hide when it is off),
 * the viewer's promotable count, and the public count an admin's un-share would move (0 for
 * everyone else). One dry run feeds both counts.
 */
export async function entityShareState(
	viewer: Viewer,
	kind: EntityKind,
	id: number
): Promise<{ publicLibraryEnabled: boolean; shareable: number; unshareable: number }> {
	const [enabled, preview] = await Promise.all([
		getSettingAs<boolean>('library.enable_public_library', 'boolean'),
		promoteEntityBooks(viewer, kind, id, { dryRun: true })
	]);
	return { publicLibraryEnabled: !!enabled, shareable: preview.promoted, unshareable: preview.alreadyPublic ?? 0 };
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

/** The book fields the per-book authority rules read */
export type BookAuthority = { id: number; libraryType: string | null };

/**
 * Check if a user can change a book's shared catalog fields (genre, format, narrator, authors,
 * series, tags, media sources): public books are the catalog managers', personal ones need
 * ownership or a read_write/full share. The single-book PUT and every bulk path use this.
 */
export async function canEditBookCatalog(user: { id: number; role: string | null }, book: BookAuthority): Promise<boolean> {
	if (book.libraryType === 'public') return canManagePublicLibrary(user);
	return canModifyBook(user.id, book.id);
}

/**
 * What a delete by this user does to a book: 'delete' removes the book for everyone, 'remove'
 * takes a public book out of the user's own library only, 'deny' leaves it alone. Public books
 * are deleted by the catalog managers and removed by anyone holding them; a personal book needs
 * ownership or a full share. No role reaches another member's personal book.
 */
export async function deleteDecision(
	user: { id: number; role: string | null },
	book: BookAuthority
): Promise<'delete' | 'remove' | 'deny'> {
	if (book.libraryType === 'public') {
		if (canManagePublicLibrary(user)) return 'delete';
		const held = await db
			.select({ id: userBooks.id })
			.from(userBooks)
			.where(and(eq(userBooks.userId, user.id), eq(userBooks.bookId, book.id)))
			.get();
		return held ? 'remove' : 'deny';
	}
	return (await canDeleteBook(user.id, book.id)) ? 'delete' : 'deny';
}

/** A book's id and library type for the per-book authority rules, or null when it doesn't exist */
export async function getBookAuthority(bookId: number): Promise<BookAuthority | null> {
	const book = await db.select({ id: books.id, libraryType: books.libraryType }).from(books).where(eq(books.id, bookId)).get();
	return book ?? null;
}

/**
 * Split bulk book ids by a per-book check: unknown ids and books that fail are skipped, never
 * written. Ids are de-duplicated and non-integers dropped as skipped.
 */
export async function partitionBooks(
	bookIds: unknown[],
	allow: (book: BookAuthority) => Promise<boolean>
): Promise<{ allowed: number[]; skipped: unknown[] }> {
	const ids = [...new Set(bookIds.filter((id): id is number => Number.isInteger(id)))];
	const rows = ids.length > 0
		? await db.select({ id: books.id, libraryType: books.libraryType }).from(books).where(inArray(books.id, ids)).all()
		: [];
	const byId = new Map(rows.map((r) => [r.id, r]));
	const allowed: number[] = [];
	const skipped: unknown[] = bookIds.filter((id) => !Number.isInteger(id));
	for (const id of ids) {
		const book = byId.get(id);
		(book && (await allow(book)) ? allowed : skipped).push(id);
	}
	return { allowed, skipped };
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
