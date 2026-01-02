import { db, narrators, books, narratorTags, tags, audiobooks } from '$lib/server/db';
import { eq, like, asc, desc, sql, and, or, inArray } from 'drizzle-orm';

// Infer Narrator type from schema
type NarratorType = typeof narrators.$inferSelect;

export interface TagInfo {
	id: number;
	name: string;
	color: string | null;
	icon: string | null;
}

export interface NarratorWithStats extends NarratorType {
	bookCount: number;
	audiobookCount: number;
	avgRating: number | null;
	coverBook?: {
		id: number;
		title: string;
		coverImageUrl: string | null;
	} | null;
	tags?: TagInfo[];
}

export interface GetNarratorsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: 'name' | 'createdAt' | 'bookCount' | 'rating';
	order?: 'asc' | 'desc';
	userId?: number; // Filter stats to user's library
	tagId?: number; // Filter by tag
	includeStats?: boolean;
}

export async function getNarrators(options: GetNarratorsOptions = {}): Promise<{
	items: NarratorWithStats[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 50, search, sort = 'name', order = 'asc', userId, tagId, includeStats = true } = options;
	const offset = (page - 1) * limit;

	// Build where conditions
	const conditions: ReturnType<typeof eq>[] = [];
	if (search) {
		conditions.push(like(narrators.name, `%${search}%`));
	}
	if (tagId) {
		conditions.push(
			sql`${narrators.id} IN (SELECT narratorId FROM narratortags WHERE tagId = ${tagId})`
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(narrators)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Get narrators
	const orderDir = order === 'asc' ? asc : desc;
	const orderColumn = sort === 'createdAt' ? narrators.createdAt : narrators.name;

	const narratorsList = await db
		.select()
		.from(narrators)
		.where(whereClause)
		.orderBy(orderDir(orderColumn))
		.limit(limit)
		.offset(offset);

	// User library condition for stats
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Get stats for each narrator
	const items = await Promise.all(
		narratorsList.map(async (narrator) => {
			// Book stats (legacy narratorId on books)
			const bookStatsResult = await db
				.select({
					count: sql<number>`count(*)`,
					avgRating: sql<number>`avg(CASE WHEN ${books.rating} > 0 THEN ${books.rating} ELSE NULL END)`
				})
				.from(books)
				.where(and(eq(books.narratorId, narrator.id), userLibraryCondition));

			// Audiobook stats (direct narratorId on audiobooks table)
			const audiobookStatsResult = await db
				.select({
					count: sql<number>`count(*)`
				})
				.from(audiobooks)
				.where(eq(audiobooks.narratorId, narrator.id));

			return {
				...narrator,
				bookCount: bookStatsResult[0]?.count ?? 0,
				audiobookCount: audiobookStatsResult[0]?.count ?? 0,
				avgRating: bookStatsResult[0]?.avgRating ? parseFloat(bookStatsResult[0].avgRating.toFixed(1)) : null
			};
		})
	);

	// If sorting by bookCount or rating, sort after fetching
	if (sort === 'bookCount') {
		items.sort((a, b) => {
			const diff = (a.bookCount + a.audiobookCount) - (b.bookCount + b.audiobookCount);
			return order === 'asc' ? diff : -diff;
		});
	} else if (sort === 'rating') {
		items.sort((a, b) => {
			const rA = a.avgRating ?? 0;
			const rB = b.avgRating ?? 0;
			const diff = rA - rB;
			return order === 'asc' ? diff : -diff;
		});
	}

	// Get tags and cover books if including stats
	if (includeStats && items.length > 0) {
		const narratorIds = items.map(n => n.id);

		// Get tags for all narrators
		const narratorTagsData = await db
			.select({
				narratorId: narratorTags.narratorId,
				tagId: tags.id,
				tagName: tags.name,
				tagColor: tags.color,
				tagIcon: tags.icon
			})
			.from(narratorTags)
			.innerJoin(tags, eq(narratorTags.tagId, tags.id))
			.where(inArray(narratorTags.narratorId, narratorIds));

		// Group tags by narratorId
		const tagsByNarrator = new Map<number, TagInfo[]>();
		for (const t of narratorTagsData) {
			if (!tagsByNarrator.has(t.narratorId)) {
				tagsByNarrator.set(t.narratorId, []);
			}
			tagsByNarrator.get(t.narratorId)!.push({
				id: t.tagId,
				name: t.tagName,
				color: t.tagColor,
				icon: t.tagIcon
			});
		}

		// Get a representative cover book for each narrator
		const coverBooksData = await db
			.select({
				narratorId: books.narratorId,
				bookId: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl
			})
			.from(books)
			.where(
				and(
					inArray(books.narratorId, narratorIds),
					sql`${books.coverImageUrl} IS NOT NULL AND ${books.coverImageUrl} != ''`
				)
			);

		// Get first cover book per narrator
		const coverBookByNarrator = new Map<number, { id: number; title: string; coverImageUrl: string | null }>();
		for (const cb of coverBooksData) {
			if (cb.narratorId && !coverBookByNarrator.has(cb.narratorId)) {
				coverBookByNarrator.set(cb.narratorId, {
					id: cb.bookId,
					title: cb.title,
					coverImageUrl: cb.coverImageUrl
				});
			}
		}

		// Enrich items with tags and cover books
		for (const item of items) {
			(item as NarratorWithStats).tags = tagsByNarrator.get(item.id) || [];
			(item as NarratorWithStats).coverBook = coverBookByNarrator.get(item.id) || null;
		}
	}

	return { items, total, page, limit };
}

export async function getNarratorById(id: number, userId?: number): Promise<NarratorWithStats | null> {
	const narrator = await db.select().from(narrators).where(eq(narrators.id, id)).limit(1);
	if (!narrator[0]) return null;

	// User library condition
	const userLibraryCondition = userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');

	// Book stats
	const bookStatsResult = await db
		.select({
			count: sql<number>`count(*)`,
			avgRating: sql<number>`avg(CASE WHEN ${books.rating} > 0 THEN ${books.rating} ELSE NULL END)`
		})
		.from(books)
		.where(and(eq(books.narratorId, id), userLibraryCondition));

	// Audiobook stats
	const audiobookStatsResult = await db
		.select({
			count: sql<number>`count(*)`
		})
		.from(audiobooks)
		.where(eq(audiobooks.narratorId, id));

	// Get tags
	const narratorTagsData = await db
		.select({
			tagId: tags.id,
			tagName: tags.name,
			tagColor: tags.color,
			tagIcon: tags.icon
		})
		.from(narratorTags)
		.innerJoin(tags, eq(narratorTags.tagId, tags.id))
		.where(eq(narratorTags.narratorId, id));

	const narratorTags2: TagInfo[] = narratorTagsData.map(t => ({
		id: t.tagId,
		name: t.tagName,
		color: t.tagColor,
		icon: t.tagIcon
	}));

	return {
		...narrator[0],
		bookCount: bookStatsResult[0]?.count ?? 0,
		audiobookCount: audiobookStatsResult[0]?.count ?? 0,
		avgRating: bookStatsResult[0]?.avgRating ? parseFloat(bookStatsResult[0].avgRating.toFixed(1)) : null,
		tags: narratorTags2
	};
}

export async function getNarratorByName(name: string): Promise<NarratorType | null> {
	const narrator = await db.select().from(narrators).where(eq(narrators.name, name)).limit(1);
	return narrator[0] || null;
}

export interface CreateNarratorData {
	name: string;
	bio?: string | null;
	birthDate?: string | null;
	deathDate?: string | null;
	birthPlace?: string | null;
	photoUrl?: string | null;
	website?: string | null;
	wikipediaUrl?: string | null;
	comments?: string | null;
}

export async function createNarrator(data: CreateNarratorData): Promise<NarratorType> {
	const now = new Date().toISOString();

	const [newNarrator] = await db
		.insert(narrators)
		.values({
			name: data.name,
			bio: data.bio || null,
			birthDate: data.birthDate || null,
			deathDate: data.deathDate || null,
			birthPlace: data.birthPlace || null,
			photoUrl: data.photoUrl || null,
			website: data.website || null,
			wikipediaUrl: data.wikipediaUrl || null,
			comments: data.comments || null,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return newNarrator;
}

export async function updateNarrator(id: number, data: Partial<CreateNarratorData>): Promise<NarratorType | null> {
	const now = new Date().toISOString();

	const updateData: Record<string, unknown> = { updatedAt: now };
	if (data.name !== undefined) updateData.name = data.name;
	if (data.bio !== undefined) updateData.bio = data.bio;
	if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
	if (data.deathDate !== undefined) updateData.deathDate = data.deathDate;
	if (data.birthPlace !== undefined) updateData.birthPlace = data.birthPlace;
	if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
	if (data.website !== undefined) updateData.website = data.website;
	if (data.wikipediaUrl !== undefined) updateData.wikipediaUrl = data.wikipediaUrl;
	if (data.comments !== undefined) updateData.comments = data.comments;

	const [updated] = await db
		.update(narrators)
		.set(updateData)
		.where(eq(narrators.id, id))
		.returning();

	return updated || null;
}

export async function deleteNarrator(id: number): Promise<boolean> {
	// Check if any books are using this narrator
	const bookCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.narratorId, id));

	// Check if any audiobooks are using this narrator
	const audiobookCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(audiobooks)
		.where(eq(audiobooks.narratorId, id));

	const totalUsage = (bookCount[0]?.count ?? 0) + (audiobookCount[0]?.count ?? 0);
	if (totalUsage > 0) {
		throw new Error(`Cannot delete narrator: ${totalUsage} audiobook(s) assigned. Please reassign or delete audiobooks first.`);
	}

	// Delete tags first
	await db.delete(narratorTags).where(eq(narratorTags.narratorId, id));

	const result = await db.delete(narrators).where(eq(narrators.id, id));
	return result.changes > 0;
}

// Get books by a narrator (filtered by user's library)
export async function getBooksByNarrator(narratorId: number, userId?: number): Promise<{ id: number; title: string; coverImageUrl: string | null; rating: number | null }[]> {
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
		.where(and(eq(books.narratorId, narratorId), userLibraryCondition))
		.orderBy(asc(books.title));
}

// Get audiobooks by a narrator
export async function getAudiobooksByNarrator(narratorId: number): Promise<{
	id: number;
	title: string;
	coverPath: string | null;
	bookId: number | null;
}[]> {
	return db
		.select({
			id: audiobooks.id,
			title: audiobooks.title,
			coverPath: audiobooks.coverPath,
			bookId: audiobooks.bookId
		})
		.from(audiobooks)
		.where(eq(audiobooks.narratorId, narratorId))
		.orderBy(asc(audiobooks.title));
}

// Get all narrators for dropdowns
export async function getAllNarrators(): Promise<{ id: number; name: string }[]> {
	return db
		.select({
			id: narrators.id,
			name: narrators.name
		})
		.from(narrators)
		.orderBy(asc(narrators.name));
}

// ============================================
// Tag Management
// ============================================

export async function getNarratorTags(narratorId: number): Promise<TagInfo[]> {
	const result = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon
		})
		.from(narratorTags)
		.innerJoin(tags, eq(narratorTags.tagId, tags.id))
		.where(eq(narratorTags.narratorId, narratorId));

	return result;
}

export async function addNarratorTag(narratorId: number, tagId: number): Promise<void> {
	const now = new Date().toISOString();

	// Check if already exists
	const existing = await db
		.select()
		.from(narratorTags)
		.where(and(eq(narratorTags.narratorId, narratorId), eq(narratorTags.tagId, tagId)))
		.limit(1);

	if (existing.length === 0) {
		await db.insert(narratorTags).values({
			narratorId,
			tagId,
			createdAt: now,
			updatedAt: now
		});
	}
}

export async function removeNarratorTag(narratorId: number, tagId: number): Promise<void> {
	await db
		.delete(narratorTags)
		.where(and(eq(narratorTags.narratorId, narratorId), eq(narratorTags.tagId, tagId)));
}

export async function setNarratorTags(narratorId: number, tagIds: number[]): Promise<void> {
	const now = new Date().toISOString();

	// Delete all existing tags
	await db.delete(narratorTags).where(eq(narratorTags.narratorId, narratorId));

	// Insert new tags
	if (tagIds.length > 0) {
		await db.insert(narratorTags).values(
			tagIds.map((tagId) => ({
				narratorId,
				tagId,
				createdAt: now,
				updatedAt: now
			}))
		);
	}
}

// ============================================
// Wikipedia Search (for metadata)
// ============================================

export interface WikipediaSearchResult {
	title: string;
	description: string;
	pageId: number;
	thumbnail?: string;
}

export async function searchWikipedia(query: string): Promise<WikipediaSearchResult[]> {
	try {
		const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' narrator OR voice actor')}&format=json&origin=*&srlimit=10`;
		const response = await fetch(searchUrl);
		const data = await response.json();

		if (!data.query?.search) return [];

		return data.query.search.map((result: { title: string; snippet: string; pageid: number }) => ({
			title: result.title,
			description: result.snippet.replace(/<[^>]*>/g, ''), // Strip HTML
			pageId: result.pageid
		}));
	} catch (error) {
		console.error('Wikipedia search error:', error);
		return [];
	}
}

export interface WikipediaDetails {
	title: string;
	extract: string;
	thumbnail?: string;
	url: string;
	birthDate?: string;
	deathDate?: string;
	birthPlace?: string;
}

export async function getWikipediaDetails(pageId: number): Promise<WikipediaDetails | null> {
	try {
		const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|pageimages|info&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=300&inprop=url&format=json&origin=*`;
		const response = await fetch(detailsUrl);
		const data = await response.json();

		const page = data.query?.pages?.[pageId];
		if (!page) return null;

		return {
			title: page.title,
			extract: page.extract || '',
			thumbnail: page.thumbnail?.source,
			url: page.fullurl
		};
	} catch (error) {
		console.error('Wikipedia details error:', error);
		return null;
	}
}
