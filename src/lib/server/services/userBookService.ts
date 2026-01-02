/**
 * User Book Service
 * Manages user-specific book data (reading status, ratings, notes, tags).
 * This separates personal reading data from shared book metadata.
 */

import { db } from '$lib/server/db';
import {
	userBooks,
	userBookTags,
	books,
	users,
	statuses,
	tags,
	type NewUserBook,
	type UserBook,
	type LibraryType
} from '$lib/server/db/schema';
import { eq, and, inArray, sql, desc, asc } from 'drizzle-orm';
import { createLogger } from './loggerService';

const log = createLogger('user-book-service');

export interface UserBookWithDetails extends UserBook {
	book?: {
		id: number;
		title: string;
		coverImageUrl: string | null;
		libraryType: string | null;
	};
	status?: {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	};
	tags?: {
		id: number;
		name: string;
		color: string | null;
	}[];
}

export interface AddToLibraryInput {
	userId: number;
	bookId: number;
	statusId?: number;
	rating?: number;
	comments?: string;
}

export interface UpdateUserBookInput {
	statusId?: number | null;
	rating?: number | null;
	startReadingDate?: string | null;
	completedDate?: string | null;
	comments?: string | null;
	readingProgress?: number | null;
	readingPosition?: string | null;
	lastReadAt?: string | null;
	dnfPage?: number | null;
	dnfPercent?: number | null;
	dnfReason?: string | null;
	dnfDate?: string | null;
}

/**
 * Add a book to the user's personal library
 */
export async function addBookToUserLibrary(input: AddToLibraryInput): Promise<UserBook> {
	const now = new Date().toISOString();

	log.info(`Adding book ${input.bookId} to user ${input.userId}'s library`);

	// Check if already in user's library
	const existing = await db
		.select()
		.from(userBooks)
		.where(and(eq(userBooks.userId, input.userId), eq(userBooks.bookId, input.bookId)))
		.limit(1);

	if (existing.length > 0) {
		log.info(`Book ${input.bookId} already in user ${input.userId}'s library`);
		return existing[0];
	}

	try {
		const [result] = await db
			.insert(userBooks)
			.values({
				userId: input.userId,
				bookId: input.bookId,
				statusId: input.statusId,
				rating: input.rating,
				comments: input.comments,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		log.info(`Successfully added book ${input.bookId} to user ${input.userId}'s library (userBook id: ${result.id})`);
		return result;
	} catch (error) {
		log.error(`Failed to add book ${input.bookId} to user ${input.userId}'s library`, { error });
		throw error;
	}
}

/**
 * Remove a book from the user's personal library
 */
export async function removeBookFromUserLibrary(userId: number, bookId: number): Promise<boolean> {
	// Also remove user's tags for this book
	await db
		.delete(userBookTags)
		.where(and(eq(userBookTags.userId, userId), eq(userBookTags.bookId, bookId)));

	const result = await db
		.delete(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)));

	return true;
}

/**
 * Get user's personal data for a specific book
 */
export async function getUserBook(userId: number, bookId: number): Promise<UserBookWithDetails | null> {
	const results = await db
		.select({
			userBook: userBooks,
			book: {
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				libraryType: books.libraryType
			},
			status: {
				id: statuses.id,
				name: statuses.name,
				color: statuses.color,
				icon: statuses.icon
			}
		})
		.from(userBooks)
		.leftJoin(books, eq(userBooks.bookId, books.id))
		.leftJoin(statuses, eq(userBooks.statusId, statuses.id))
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.limit(1);

	if (results.length === 0) return null;

	const row = results[0];

	// Get user's tags for this book
	const userTags = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color
		})
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(and(eq(userBookTags.userId, userId), eq(userBookTags.bookId, bookId)));

	return {
		...row.userBook,
		book: row.book || undefined,
		status: row.status || undefined,
		tags: userTags
	};
}

/**
 * Update user's personal data for a book
 */
export async function updateUserBook(
	userId: number,
	bookId: number,
	data: UpdateUserBookInput
): Promise<UserBook | null> {
	const now = new Date().toISOString();

	const [result] = await db
		.update(userBooks)
		.set({
			...data,
			updatedAt: now
		})
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.returning();

	return result || null;
}

/**
 * Check if a book is in the user's library
 */
export async function isInUserLibrary(userId: number, bookId: number): Promise<boolean> {
	const result = await db
		.select({ id: userBooks.id })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.limit(1);

	return result.length > 0;
}

/**
 * Get all books in user's personal library
 */
export async function getUserLibraryBooks(
	userId: number,
	options: {
		statusId?: number;
		page?: number;
		limit?: number;
		sortField?: string;
		sortOrder?: 'asc' | 'desc';
	} = {}
): Promise<{ items: UserBookWithDetails[]; total: number }> {
	const { statusId, page = 1, limit = 24, sortField = 'addedAt', sortOrder = 'desc' } = options;

	// Build where conditions
	const conditions = [eq(userBooks.userId, userId)];
	if (statusId) {
		conditions.push(eq(userBooks.statusId, statusId));
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(userBooks)
		.where(and(...conditions));
	const total = countResult[0]?.count || 0;

	// Get paginated results
	// Determine sort column - use SQL raw for flexibility
	type SortableColumn = typeof userBooks.addedAt | typeof userBooks.rating | typeof userBooks.completedDate | typeof userBooks.startReadingDate | typeof userBooks.createdAt;
	let sortColumn: SortableColumn = userBooks.addedAt;
	switch (sortField) {
		case 'rating': sortColumn = userBooks.rating; break;
		case 'completedDate': sortColumn = userBooks.completedDate; break;
		case 'startReadingDate': sortColumn = userBooks.startReadingDate; break;
		case 'createdAt': sortColumn = userBooks.createdAt; break;
		default: sortColumn = userBooks.addedAt;
	}

	const results = await db
		.select({
			userBook: userBooks,
			book: {
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				libraryType: books.libraryType
			},
			status: {
				id: statuses.id,
				name: statuses.name,
				color: statuses.color,
				icon: statuses.icon
			}
		})
		.from(userBooks)
		.leftJoin(books, eq(userBooks.bookId, books.id))
		.leftJoin(statuses, eq(userBooks.statusId, statuses.id))
		.where(and(...conditions))
		.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
		.limit(limit)
		.offset((page - 1) * limit);

	// Get tags for all books
	const bookIds = results.map(r => r.userBook.bookId);
	const allTags =
		bookIds.length > 0
			? await db
					.select({
						bookId: userBookTags.bookId,
						tagId: tags.id,
						tagName: tags.name,
						tagColor: tags.color
					})
					.from(userBookTags)
					.innerJoin(tags, eq(userBookTags.tagId, tags.id))
					.where(and(eq(userBookTags.userId, userId), inArray(userBookTags.bookId, bookIds)))
			: [];

	// Group tags by book
	const tagsByBook = new Map<number, { id: number; name: string; color: string | null }[]>();
	for (const t of allTags) {
		if (!tagsByBook.has(t.bookId)) {
			tagsByBook.set(t.bookId, []);
		}
		tagsByBook.get(t.bookId)!.push({ id: t.tagId, name: t.tagName, color: t.tagColor });
	}

	const items: UserBookWithDetails[] = results.map(row => ({
		...row.userBook,
		book: row.book || undefined,
		status: row.status || undefined,
		tags: tagsByBook.get(row.userBook.bookId) || []
	}));

	return { items, total };
}

/**
 * Add tags to a user's book
 */
export async function addUserBookTags(userId: number, bookId: number, tagIds: number[]): Promise<void> {
	const now = new Date().toISOString();

	// Get existing tags
	const existing = await db
		.select({ tagId: userBookTags.tagId })
		.from(userBookTags)
		.where(and(eq(userBookTags.userId, userId), eq(userBookTags.bookId, bookId)));

	const existingTagIds = new Set(existing.map(e => e.tagId));
	const newTagIds = tagIds.filter(id => !existingTagIds.has(id));

	if (newTagIds.length > 0) {
		await db.insert(userBookTags).values(
			newTagIds.map(tagId => ({
				userId,
				bookId,
				tagId,
				createdAt: now
			}))
		);
	}
}

/**
 * Remove tags from a user's book
 */
export async function removeUserBookTags(userId: number, bookId: number, tagIds: number[]): Promise<void> {
	if (tagIds.length === 0) return;

	await db
		.delete(userBookTags)
		.where(
			and(
				eq(userBookTags.userId, userId),
				eq(userBookTags.bookId, bookId),
				inArray(userBookTags.tagId, tagIds)
			)
		);
}

/**
 * Set tags for a user's book (replaces all existing)
 */
export async function setUserBookTags(userId: number, bookId: number, tagIds: number[]): Promise<void> {
	const now = new Date().toISOString();

	// Delete all existing tags
	await db
		.delete(userBookTags)
		.where(and(eq(userBookTags.userId, userId), eq(userBookTags.bookId, bookId)));

	// Insert new tags
	if (tagIds.length > 0) {
		await db.insert(userBookTags).values(
			tagIds.map(tagId => ({
				userId,
				bookId,
				tagId,
				createdAt: now
			}))
		);
	}
}

/**
 * Get user's tags for a book
 */
export async function getUserBookTags(
	userId: number,
	bookId: number
): Promise<{ id: number; name: string; color: string | null }[]> {
	return db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color
		})
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(and(eq(userBookTags.userId, userId), eq(userBookTags.bookId, bookId)));
}

/**
 * Bulk add books to user's library
 */
export async function bulkAddToUserLibrary(
	userId: number,
	bookIds: number[],
	options: { statusId?: number } = {}
): Promise<number> {
	const now = new Date().toISOString();

	// Get existing books in user's library
	const existing = await db
		.select({ bookId: userBooks.bookId })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), inArray(userBooks.bookId, bookIds)));

	const existingIds = new Set(existing.map(e => e.bookId));
	const newBookIds = bookIds.filter(id => !existingIds.has(id));

	if (newBookIds.length > 0) {
		await db.insert(userBooks).values(
			newBookIds.map(bookId => ({
				userId,
				bookId,
				statusId: options.statusId,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	return newBookIds.length;
}

/**
 * Bulk remove books from user's library
 */
export async function bulkRemoveFromUserLibrary(userId: number, bookIds: number[]): Promise<number> {
	if (bookIds.length === 0) return 0;

	// Remove tags first
	await db
		.delete(userBookTags)
		.where(and(eq(userBookTags.userId, userId), inArray(userBookTags.bookId, bookIds)));

	// Remove from library
	await db
		.delete(userBooks)
		.where(and(eq(userBooks.userId, userId), inArray(userBooks.bookId, bookIds)));

	return bookIds.length;
}

/**
 * Get user's reading statistics from their personal library
 */
export async function getUserReadingStats(userId: number): Promise<{
	totalBooks: number;
	booksRead: number;
	currentlyReading: number;
	averageRating: number | null;
	totalPagesRead: number;
}> {
	// Get count by status
	const statusCounts = await db
		.select({
			statusKey: statuses.key,
			count: sql<number>`count(*)`
		})
		.from(userBooks)
		.leftJoin(statuses, eq(userBooks.statusId, statuses.id))
		.where(eq(userBooks.userId, userId))
		.groupBy(statuses.key);

	const countMap = new Map(statusCounts.map(s => [s.statusKey, s.count]));

	// Get average rating
	const avgResult = await db
		.select({ avg: sql<number>`avg(rating)` })
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), sql`rating IS NOT NULL`));

	// Get total pages read (from completed books)
	const pagesResult = await db
		.select({ total: sql<number>`sum(${books.pageCount})` })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.innerJoin(statuses, eq(userBooks.statusId, statuses.id))
		.where(and(eq(userBooks.userId, userId), eq(statuses.key, 'READ')));

	// Get total books in library
	const totalResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(userBooks)
		.where(eq(userBooks.userId, userId));

	return {
		totalBooks: totalResult[0]?.count || 0,
		booksRead: countMap.get('READ') || 0,
		currentlyReading: countMap.get('CURRENT') || 0,
		averageRating: avgResult[0]?.avg || null,
		totalPagesRead: pagesResult[0]?.total || 0
	};
}
