import { db, genres, books } from '$lib/server/db';
import { eq, like, asc, desc, sql, and, or } from 'drizzle-orm';
import type { Genre } from '$lib/server/db/schema';

export interface GenreWithStats extends Genre {
	bookCount: number;
	avgRating: number | null;
}

export interface GetGenresOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'name' | 'createdAt' | 'displayOrder' | 'bookCount';
	order?: 'asc' | 'desc';
	userId?: number; // Filter stats to user's library
}

export async function getGenres(options: GetGenresOptions = {}): Promise<{
	items: GenreWithStats[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 50, search, sort = 'displayOrder', order = 'asc', userId } = options;
	const offset = (page - 1) * limit;

	// User library condition: personal books OR books user has added from public library
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Build where conditions
	const whereClause = search ? like(genres.name, `%${search}%`) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(genres)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get genres
	const orderDir = order === 'asc' ? asc : desc;
	let orderColumn;
	switch (sort) {
		case 'name':
			orderColumn = genres.name;
			break;
		case 'createdAt':
			orderColumn = genres.createdAt;
			break;
		default:
			orderColumn = genres.displayOrder;
	}

	const genresList = await db
		.select()
		.from(genres)
		.where(whereClause)
		.orderBy(
			// If sorting by displayOrder, put 0s last
			sort === 'displayOrder'
				? sql`CASE WHEN ${genres.displayOrder} = 0 OR ${genres.displayOrder} IS NULL THEN 999999 ELSE ${genres.displayOrder} END ASC`
				: orderDir(orderColumn),
			asc(genres.name)
		)
		.limit(limit)
		.offset(offset);

	// Get book counts and avg ratings for each genre (filtered by user's library)
	const items = await Promise.all(
		genresList.map(async (genre) => {
			const statsResult = await db
				.select({
					count: sql<number>`count(*)`,
					avgRating: sql<number>`avg(CASE WHEN ${books.rating} > 0 THEN ${books.rating} ELSE NULL END)`
				})
				.from(books)
				.where(and(eq(books.genreId, genre.id), userLibraryCondition));

			return {
				...genre,
				bookCount: statsResult[0]?.count ?? 0,
				avgRating: statsResult[0]?.avgRating ? parseFloat(statsResult[0].avgRating.toFixed(1)) : null
			};
		})
	);

	// If sorting by bookCount, we need to sort after fetching counts
	if (sort === 'bookCount') {
		items.sort((a, b) => {
			const diff = a.bookCount - b.bookCount;
			return order === 'asc' ? diff : -diff;
		});
	}

	return { items, total, page, limit };
}

export async function getGenreById(id: number, userId?: number): Promise<GenreWithStats | null> {
	const genre = await db.select().from(genres).where(eq(genres.id, id)).limit(1);
	if (!genre[0]) return null;

	// User library condition
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	const statsResult = await db
		.select({
			count: sql<number>`count(*)`,
			avgRating: sql<number>`avg(CASE WHEN ${books.rating} > 0 THEN ${books.rating} ELSE NULL END)`
		})
		.from(books)
		.where(and(eq(books.genreId, id), userLibraryCondition));

	return {
		...genre[0],
		bookCount: statsResult[0]?.count ?? 0,
		avgRating: statsResult[0]?.avgRating ? parseFloat(statsResult[0].avgRating.toFixed(1)) : null
	};
}

export async function getGenreByName(name: string): Promise<Genre | null> {
	const genre = await db.select().from(genres).where(eq(genres.name, name)).limit(1);
	return genre[0] || null;
}

export interface CreateGenreData {
	name: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	displayOrder?: number;
}

export async function createGenre(data: CreateGenreData): Promise<Genre> {
	const now = new Date().toISOString();

	const [newGenre] = await db
		.insert(genres)
		.values({
			name: data.name,
			description: data.description || null,
			color: data.color || null,
			icon: data.icon || null,
			displayOrder: data.displayOrder ?? 0,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return newGenre;
}

export async function updateGenre(id: number, data: Partial<CreateGenreData>): Promise<Genre | null> {
	const now = new Date().toISOString();

	const updateData: Record<string, unknown> = { updatedAt: now };
	if (data.name !== undefined) updateData.name = data.name;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.color !== undefined) updateData.color = data.color;
	if (data.icon !== undefined) updateData.icon = data.icon;
	if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

	const [updated] = await db.update(genres).set(updateData).where(eq(genres.id, id)).returning();

	return updated || null;
}

export async function deleteGenre(id: number): Promise<boolean> {
	// Check if any books are assigned to this genre
	const bookCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.genreId, id));

	if (bookCount[0]?.count > 0) {
		throw new Error(`Cannot delete genre: ${bookCount[0].count} book(s) assigned. Please reassign or delete books first.`);
	}

	const result = await db.delete(genres).where(eq(genres.id, id));
	return result.changes > 0;
}

// Get books in a genre (filtered by user's library)
export async function getBooksInGenre(genreId: number, userId?: number): Promise<{ id: number; title: string; coverImageUrl: string | null; rating: number | null }[]> {
	// User library condition
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			rating: books.rating
		})
		.from(books)
		.where(and(eq(books.genreId, genreId), userLibraryCondition))
		.orderBy(asc(books.title));
}

// Get all genres for dropdowns
export async function getAllGenres(): Promise<{ id: number; name: string; color: string | null }[]> {
	return db
		.select({
			id: genres.id,
			name: genres.name,
			color: genres.color
		})
		.from(genres)
		.orderBy(
			sql`CASE WHEN ${genres.displayOrder} = 0 OR ${genres.displayOrder} IS NULL THEN 999999 ELSE ${genres.displayOrder} END ASC`,
			asc(genres.name)
		);
}
