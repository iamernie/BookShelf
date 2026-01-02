import { db, formats, books } from '$lib/server/db';
import { eq, like, asc, desc, sql } from 'drizzle-orm';
import type { Format } from '$lib/server/db/schema';

// Infer Format type from schema since it's not exported
type FormatType = typeof formats.$inferSelect;

export interface FormatWithCount extends FormatType {
	bookCount: number;
}

export interface GetFormatsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'name' | 'createdAt' | 'bookCount';
	order?: 'asc' | 'desc';
}

export async function getFormats(options: GetFormatsOptions = {}): Promise<{
	items: FormatWithCount[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 50, search, sort = 'name', order = 'asc' } = options;
	const offset = (page - 1) * limit;

	const whereClause = search ? like(formats.name, `%${search}%`) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(formats)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get formats
	const orderDir = order === 'asc' ? asc : desc;
	const orderColumn = sort === 'createdAt' ? formats.createdAt : formats.name;

	const formatsList = await db
		.select()
		.from(formats)
		.where(whereClause)
		.orderBy(orderDir(orderColumn))
		.limit(limit)
		.offset(offset);

	// Get book counts for each format
	const items = await Promise.all(
		formatsList.map(async (format) => {
			const countResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(books)
				.where(eq(books.formatId, format.id));

			return {
				...format,
				bookCount: countResult[0]?.count ?? 0
			};
		})
	);

	// If sorting by bookCount, sort after fetching
	if (sort === 'bookCount') {
		items.sort((a, b) => {
			const diff = a.bookCount - b.bookCount;
			return order === 'asc' ? diff : -diff;
		});
	}

	return { items, total, page, limit };
}

export async function getFormatById(id: number): Promise<FormatWithCount | null> {
	const format = await db.select().from(formats).where(eq(formats.id, id)).limit(1);
	if (!format[0]) return null;

	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.formatId, id));

	return {
		...format[0],
		bookCount: countResult[0]?.count ?? 0
	};
}

export async function getFormatByName(name: string): Promise<FormatType | null> {
	const format = await db.select().from(formats).where(eq(formats.name, name)).limit(1);
	return format[0] || null;
}

export async function createFormat(data: { name: string; icon?: string; color?: string }): Promise<FormatType> {
	const now = new Date().toISOString();

	const [newFormat] = await db
		.insert(formats)
		.values({
			name: data.name,
			icon: data.icon || 'book',
			color: data.color || '#6c757d',
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return newFormat;
}

export async function updateFormat(id: number, data: { name: string; icon?: string; color?: string }): Promise<FormatType | null> {
	const now = new Date().toISOString();

	const updateData: Record<string, unknown> = {
		name: data.name,
		updatedAt: now
	};

	if (data.icon !== undefined) {
		updateData.icon = data.icon;
	}
	if (data.color !== undefined) {
		updateData.color = data.color;
	}

	const [updated] = await db
		.update(formats)
		.set(updateData)
		.where(eq(formats.id, id))
		.returning();

	return updated || null;
}

export async function deleteFormat(id: number, reassignToId?: number): Promise<boolean> {
	// Check if any books are using this format
	const bookCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.formatId, id));

	if (bookCount[0]?.count > 0) {
		if (reassignToId === undefined) {
			throw new Error(`Cannot delete format: ${bookCount[0].count} book(s) assigned. Please choose a format to reassign them to.`);
		}

		// Verify the target format exists (unless reassigning to null)
		if (reassignToId !== null) {
			const targetFormat = await db.select().from(formats).where(eq(formats.id, reassignToId)).limit(1);
			if (!targetFormat[0]) {
				throw new Error('Target format for reassignment not found');
			}
		}

		// Reassign all books to the new format
		await db
			.update(books)
			.set({ formatId: reassignToId, updatedAt: new Date().toISOString() })
			.where(eq(books.formatId, id));
	}

	const result = await db.delete(formats).where(eq(formats.id, id));
	return result.changes > 0;
}

// Get books in a format
export async function getBooksInFormat(formatId: number): Promise<{ id: number; title: string; coverImageUrl: string | null }[]> {
	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
		.from(books)
		.where(eq(books.formatId, formatId))
		.orderBy(asc(books.title));
}

// Get all formats for dropdowns
export async function getAllFormats(): Promise<{ id: number; name: string }[]> {
	return db
		.select({
			id: formats.id,
			name: formats.name
		})
		.from(formats)
		.orderBy(asc(formats.name));
}
