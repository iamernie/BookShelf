import { db, tags, bookTags, seriesTags, authorTags, narratorTags, books, series, authors, narrators } from '$lib/server/db';
import { eq, like, asc, desc, sql, and, or } from 'drizzle-orm';
import type { Tag } from '$lib/server/db/schema';

// Predefined colors for tags (matching V1)
export const TAG_COLORS = [
	{ name: 'Red', value: '#dc3545' },
	{ name: 'Orange', value: '#fd7e14' },
	{ name: 'Yellow', value: '#ffc107' },
	{ name: 'Green', value: '#28a745' },
	{ name: 'Teal', value: '#20c997' },
	{ name: 'Blue', value: '#007bff' },
	{ name: 'Indigo', value: '#6610f2' },
	{ name: 'Purple', value: '#6f42c1' },
	{ name: 'Pink', value: '#e83e8c' },
	{ name: 'Gray', value: '#6c757d' }
];

// System tags that are created automatically
const SYSTEM_TAGS = [
	{ name: 'Favorite', color: '#dc3545', icon: 'heart', isSystem: true },
	{ name: 'Wishlist', color: '#ffc107', icon: 'star', isSystem: true }
];

export interface TagWithCount extends Tag {
	bookCount: number;
	seriesCount: number;
	authorCount: number;
}

export interface GetTagsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'name' | 'createdAt' | 'bookCount';
	order?: 'asc' | 'desc';
	userId?: number; // Filter stats to user's library
}

export async function getTags(options: GetTagsOptions = {}): Promise<{
	items: TagWithCount[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 50, search, sort = 'name', order = 'asc', userId } = options;
	const offset = (page - 1) * limit;

	// Build where conditions
	const whereClause = search ? like(tags.name, `%${search}%`) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(tags)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get tags - system tags first, then by sort order
	const orderDir = order === 'asc' ? asc : desc;
	const orderColumn = sort === 'createdAt' ? tags.createdAt : tags.name;

	const tagsList = await db
		.select()
		.from(tags)
		.where(whereClause)
		.orderBy(desc(tags.isSystem), orderDir(orderColumn))
		.limit(limit)
		.offset(offset);

	// Get counts for each tag (book count filtered by user's library)
	const items = await Promise.all(
		tagsList.map(async (tag) => {
			// For book count, filter to user's library
			let bookCount = 0;
			if (userId) {
				const bookCountResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(bookTags)
					.innerJoin(books, eq(bookTags.bookId, books.id))
					.where(
						and(
							eq(bookTags.tagId, tag.id),
							or(
								eq(books.libraryType, 'personal'),
								sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
							)
						)
					);
				bookCount = bookCountResult[0]?.count ?? 0;
			} else {
				const bookCountResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(bookTags)
					.innerJoin(books, eq(bookTags.bookId, books.id))
					.where(and(eq(bookTags.tagId, tag.id), eq(books.libraryType, 'personal')));
				bookCount = bookCountResult[0]?.count ?? 0;
			}

			// Series count stays the same (not filtered by library)
			const seriesCountResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(seriesTags)
				.where(eq(seriesTags.tagId, tag.id));

			// Author count
			const authorCountResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(authorTags)
				.where(eq(authorTags.tagId, tag.id));

			return {
				...tag,
				bookCount,
				seriesCount: seriesCountResult[0]?.count ?? 0,
				authorCount: authorCountResult[0]?.count ?? 0
			};
		})
	);

	// If sorting by bookCount, we need to sort after fetching counts
	if (sort === 'bookCount') {
		items.sort((a, b) => {
			// System tags always first
			if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
			const diff = a.bookCount - b.bookCount;
			return order === 'asc' ? diff : -diff;
		});
	}

	return { items, total, page, limit };
}

export async function getTagById(id: number, userId?: number): Promise<TagWithCount | null> {
	const tag = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
	if (!tag[0]) return null;

	// For book count, filter to user's library
	let bookCount = 0;
	if (userId) {
		const bookCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(bookTags)
			.innerJoin(books, eq(bookTags.bookId, books.id))
			.where(
				and(
					eq(bookTags.tagId, id),
					or(
						eq(books.libraryType, 'personal'),
						sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
					)
				)
			);
		bookCount = bookCountResult[0]?.count ?? 0;
	} else {
		const bookCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(bookTags)
			.innerJoin(books, eq(bookTags.bookId, books.id))
			.where(and(eq(bookTags.tagId, id), eq(books.libraryType, 'personal')));
		bookCount = bookCountResult[0]?.count ?? 0;
	}

	const seriesCountResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(seriesTags)
		.where(eq(seriesTags.tagId, id));

	const authorCountResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(authorTags)
		.where(eq(authorTags.tagId, id));

	return {
		...tag[0],
		bookCount,
		seriesCount: seriesCountResult[0]?.count ?? 0,
		authorCount: authorCountResult[0]?.count ?? 0
	};
}

export async function getTagByName(name: string): Promise<Tag | null> {
	const tag = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
	return tag[0] || null;
}

export interface CreateTagData {
	name: string;
	color?: string;
	icon?: string | null;
}

export async function createTag(data: CreateTagData): Promise<Tag> {
	const now = new Date().toISOString();

	const [newTag] = await db
		.insert(tags)
		.values({
			name: data.name,
			color: data.color || '#6c757d',
			icon: data.icon || null,
			isSystem: false,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return newTag;
}

export interface UpdateTagData {
	name?: string;
	color?: string;
	icon?: string | null;
}

export async function updateTag(id: number, data: UpdateTagData): Promise<Tag | null> {
	const now = new Date().toISOString();

	// Get existing tag to check if system
	const existing = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
	if (!existing[0]) return null;

	// Build update data - system tags can't have name changed
	const updateData: Record<string, unknown> = { updatedAt: now };
	if (data.color !== undefined) updateData.color = data.color;
	if (data.icon !== undefined) updateData.icon = data.icon;
	if (!existing[0].isSystem && data.name !== undefined) {
		updateData.name = data.name;
	}

	const [updated] = await db.update(tags).set(updateData).where(eq(tags.id, id)).returning();

	return updated || null;
}

export async function deleteTag(id: number): Promise<boolean> {
	// Get existing tag to check if system
	const existing = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
	if (!existing[0]) return false;

	// Can't delete system tags
	if (existing[0].isSystem) {
		throw new Error('System tags cannot be deleted');
	}

	// Delete all associations first (cascade should handle this, but being explicit)
	await db.delete(bookTags).where(eq(bookTags.tagId, id));
	await db.delete(seriesTags).where(eq(seriesTags.tagId, id));
	await db.delete(authorTags).where(eq(authorTags.tagId, id));

	// Delete the tag
	const result = await db.delete(tags).where(eq(tags.id, id));
	return result.changes > 0;
}

// Quick create tag with default color (for use in book/series forms)
export async function quickCreateTag(name: string): Promise<Tag> {
	const trimmedName = name.trim();

	// Check if tag already exists
	const existing = await getTagByName(trimmedName);
	if (existing) {
		throw new Error('A tag with this name already exists');
	}

	return createTag({ name: trimmedName, color: '#6c757d' });
}

// Toggle tag on a book
export async function toggleBookTag(bookId: number, tagId: number): Promise<{ action: 'added' | 'removed' }> {
	const existing = await db
		.select()
		.from(bookTags)
		.where(sql`${bookTags.bookId} = ${bookId} AND ${bookTags.tagId} = ${tagId}`)
		.limit(1);

	if (existing[0]) {
		await db.delete(bookTags).where(sql`${bookTags.bookId} = ${bookId} AND ${bookTags.tagId} = ${tagId}`);
		return { action: 'removed' };
	} else {
		const now = new Date().toISOString();
		await db.insert(bookTags).values({ bookId, tagId, createdAt: now, updatedAt: now });
		return { action: 'added' };
	}
}

// Toggle tag on a series
export async function toggleSeriesTag(seriesId: number, tagId: number): Promise<{ action: 'added' | 'removed' }> {
	const existing = await db
		.select()
		.from(seriesTags)
		.where(sql`${seriesTags.seriesId} = ${seriesId} AND ${seriesTags.tagId} = ${tagId}`)
		.limit(1);

	if (existing[0]) {
		await db.delete(seriesTags).where(sql`${seriesTags.seriesId} = ${seriesId} AND ${seriesTags.tagId} = ${tagId}`);
		return { action: 'removed' };
	} else {
		const now = new Date().toISOString();
		await db.insert(seriesTags).values({ seriesId, tagId, createdAt: now, updatedAt: now });
		return { action: 'added' };
	}
}

// Get books with a specific tag (filtered by user's library)
export async function getBooksWithTag(tagId: number, userId?: number): Promise<{ id: number; title: string; coverImageUrl: string | null }[]> {
	// User library condition
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	const booksList = await db
		.select({ id: books.id, title: books.title, coverImageUrl: books.coverImageUrl })
		.from(books)
		.innerJoin(bookTags, eq(books.id, bookTags.bookId))
		.where(and(eq(bookTags.tagId, tagId), userLibraryCondition))
		.orderBy(asc(books.title));

	return booksList;
}

// Get series with a specific tag
export async function getSeriesWithTag(tagId: number): Promise<{ id: number; title: string }[]> {
	const seriesIds = await db.select({ seriesId: seriesTags.seriesId }).from(seriesTags).where(eq(seriesTags.tagId, tagId));

	if (seriesIds.length === 0) return [];

	const seriesList = await db
		.select({ id: series.id, title: series.title })
		.from(series)
		.where(sql`${series.id} IN (${seriesIds.map((s) => s.seriesId).join(',')})`)
		.orderBy(asc(series.title));

	return seriesList;
}

// Initialize system tags (call on app startup)
export async function initializeSystemTags(): Promise<void> {
	const now = new Date().toISOString();

	for (const tagData of SYSTEM_TAGS) {
		const existing = await getTagByName(tagData.name);

		if (!existing) {
			// Create the system tag
			await db.insert(tags).values({
				...tagData,
				createdAt: now,
				updatedAt: now
			});
		} else if (!existing.isSystem) {
			// Update existing tag to be a system tag
			await db
				.update(tags)
				.set({
					isSystem: true,
					icon: tagData.icon,
					color: tagData.color,
					updatedAt: now
				})
				.where(eq(tags.id, existing.id));
		}
	}
}

// Get all tags (simple list for dropdowns)
export async function getAllTags(): Promise<{ id: number; name: string; color: string | null; icon: string | null; isSystem: boolean | null }[]> {
	return db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon,
			isSystem: tags.isSystem
		})
		.from(tags)
		.orderBy(desc(tags.isSystem), asc(tags.name));
}

// ========== Author Tag Functions ==========

// Toggle tag on an author
export async function toggleAuthorTag(authorId: number, tagId: number): Promise<{ action: 'added' | 'removed' }> {
	const existing = await db
		.select()
		.from(authorTags)
		.where(sql`${authorTags.authorId} = ${authorId} AND ${authorTags.tagId} = ${tagId}`)
		.limit(1);

	if (existing[0]) {
		await db.delete(authorTags).where(sql`${authorTags.authorId} = ${authorId} AND ${authorTags.tagId} = ${tagId}`);
		return { action: 'removed' };
	} else {
		const now = new Date().toISOString();
		await db.insert(authorTags).values({ authorId, tagId, createdAt: now, updatedAt: now });
		return { action: 'added' };
	}
}

// Get tags for an author
export async function getAuthorTags(authorId: number): Promise<{ id: number; name: string; color: string | null; icon: string | null; isSystem: boolean | null }[]> {
	const tagIds = await db
		.select({ tagId: authorTags.tagId })
		.from(authorTags)
		.where(eq(authorTags.authorId, authorId));

	if (tagIds.length === 0) return [];

	const tagList = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon,
			isSystem: tags.isSystem
		})
		.from(tags)
		.where(sql`${tags.id} IN (${tagIds.map((t) => t.tagId).join(',')})`)
		.orderBy(desc(tags.isSystem), asc(tags.name));

	return tagList;
}

// Get authors with a specific tag
export async function getAuthorsWithTag(tagId: number): Promise<{ id: number; name: string; photoUrl: string | null }[]> {
	const authorIds = await db
		.select({ authorId: authorTags.authorId })
		.from(authorTags)
		.where(eq(authorTags.tagId, tagId));

	if (authorIds.length === 0) return [];

	const authorList = await db
		.select({ id: authors.id, name: authors.name, photoUrl: authors.photoUrl })
		.from(authors)
		.where(sql`${authors.id} IN (${authorIds.map((a) => a.authorId).join(',')})`)
		.orderBy(asc(authors.name));

	return authorList;
}

// ========== Narrator Tag Functions ==========

// Toggle tag on a narrator
export async function toggleNarratorTag(narratorId: number, tagId: number): Promise<{ action: 'added' | 'removed' }> {
	const existing = await db
		.select()
		.from(narratorTags)
		.where(sql`${narratorTags.narratorId} = ${narratorId} AND ${narratorTags.tagId} = ${tagId}`)
		.limit(1);

	if (existing[0]) {
		await db.delete(narratorTags).where(sql`${narratorTags.narratorId} = ${narratorId} AND ${narratorTags.tagId} = ${tagId}`);
		return { action: 'removed' };
	} else {
		const now = new Date().toISOString();
		await db.insert(narratorTags).values({ narratorId, tagId, createdAt: now, updatedAt: now });
		return { action: 'added' };
	}
}

// Get tags for a narrator
export async function getNarratorTags(narratorId: number): Promise<{ id: number; name: string; color: string | null; icon: string | null; isSystem: boolean | null }[]> {
	const tagIds = await db
		.select({ tagId: narratorTags.tagId })
		.from(narratorTags)
		.where(eq(narratorTags.narratorId, narratorId));

	if (tagIds.length === 0) return [];

	const tagList = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon,
			isSystem: tags.isSystem
		})
		.from(tags)
		.where(sql`${tags.id} IN (${tagIds.map((t) => t.tagId).join(',')})`)
		.orderBy(desc(tags.isSystem), asc(tags.name));

	return tagList;
}

// Get narrators with a specific tag
export async function getNarratorsWithTag(tagId: number): Promise<{ id: number; name: string; photoUrl: string | null }[]> {
	const narratorIds = await db
		.select({ narratorId: narratorTags.narratorId })
		.from(narratorTags)
		.where(eq(narratorTags.tagId, tagId));

	if (narratorIds.length === 0) return [];

	const narratorList = await db
		.select({ id: narrators.id, name: narrators.name, photoUrl: narrators.photoUrl })
		.from(narrators)
		.where(sql`${narrators.id} IN (${narratorIds.map((n) => n.narratorId).join(',')})`)
		.orderBy(asc(narrators.name));

	return narratorList;
}
