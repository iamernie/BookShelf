import { db, narrators, books, narratorTags, tags } from '$lib/server/db';
import { eq, like, asc, desc, sql, and, inArray, getTableColumns, type SQL } from 'drizzle-orm';
import { viewerBooks as vub } from './personalState';
import { reachableBookCond, reachableEntityCond, canReachEntity, type Viewer } from './libraryShareService';
import { stripHtmlTags } from './metadataProviders/types';
import { duplicateNameKey } from '$lib/server/utils/nameNormalization';

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
	avgRating: number | null;
	coverBook?: {
		id: number;
		title: string;
		coverImageUrl: string | null;
	} | null;
	tags?: TagInfo[];
}

/** List rows carry no shared comments (the detail page still does until per-user notes land) */
export type NarratorListItem = Omit<NarratorWithStats, 'comments'>;

// Every narrator column but comments, for list rows
const { comments: _comments, ...narratorListColumns } = getTableColumns(narrators);

/**
 * Narrator lists, cards and detail pages are reach-scoped (2.31.0): a narrator shows when a book
 * they narrate (books.narratorId) is one the viewer can see (reachableEntityCond), and counts,
 * covers and the detail book list run over those books (reachableBookCond). Ratings stay the
 * viewer's own rows.
 */

export type NarratorSort = 'name' | 'createdAt' | 'updatedAt' | 'bookCount' | 'rating';

export interface GetNarratorsOptions {
	page?: number;
	limit?: number;
	search?: string;
	sort?: NarratorSort;
	order?: 'asc' | 'desc';
	viewer?: Viewer; // Scopes the list and its figures to the books this viewer can see
	tagId?: number; // Filter by tag
	includeStats?: boolean;
}

export async function getNarrators(options: GetNarratorsOptions = {}): Promise<{
	items: NarratorListItem[];
	total: number;
	page: number;
	limit: number;
}> {
	const { page = 1, limit = 50, search, sort = 'name', order = 'asc', viewer, tagId, includeStats = true } = options;
	const userId = viewer?.id;
	const offset = (page - 1) * limit;

	// Only narrators with at least one book the viewer can see
	const conditions: SQL[] = [reachableEntityCond(viewer, 'narrator', sql`narrators.id`)];
	if (search) {
		conditions.push(like(narrators.name, `%${search}%`));
	}
	if (tagId) {
		conditions.push(
			sql`${narrators.id} IN (SELECT narratorId FROM narratortags WHERE tagId = ${tagId})`
		);
	}

	const whereClause = and(...conditions);

	// Get total count (same gate as the list)
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(narrators)
		.where(whereClause);
	const total = countResult[0]?.count ?? 0;

	// Stats count the books the viewer can see
	const userLibraryCondition = reachableBookCond(viewer, 'books');

	// Sorted in SQL over the whole list, so every page is in order. sort and order are never
	// interpolated: direction is one of two literals, the column comes from the switch. The stat
	// subqueries read unaliased FROM books because userLibraryCondition is written on books.
	const dir = order === 'asc' ? sql`ASC` : sql`DESC`;
	const byName = sql`narrators.name COLLATE NOCASE ASC`;
	let orderTerms: SQL[];
	switch (sort) {
		case 'bookCount':
			orderTerms = [sql`(SELECT COUNT(*) FROM books WHERE books.narratorId = narrators.id AND ${userLibraryCondition}) ${dir}`, byName, sql`narrators.id ASC`];
			break;
		case 'rating':
			orderTerms = [sql`(SELECT ROUND(AVG(vub.rating), 1) FROM books LEFT JOIN user_books vub ON vub.bookId = books.id AND vub.userId = ${userId ?? -1} WHERE books.narratorId = narrators.id AND vub.rating > 0 AND ${userLibraryCondition}) ${dir} NULLS LAST`, byName, sql`narrators.id ASC`];
			break;
		case 'createdAt':
			orderTerms = [sql`narrators.createdAt ${dir} NULLS LAST`, sql`narrators.id ${dir}`];
			break;
		case 'updatedAt':
			orderTerms = [sql`narrators.updatedAt ${dir} NULLS LAST`, sql`narrators.id ${dir}`];
			break;
		default:
			orderTerms = [sql`narrators.name COLLATE NOCASE ${dir}`, sql`narrators.id ASC`];
	}

	const narratorsList = await db
		.select(narratorListColumns)
		.from(narrators)
		.where(whereClause)
		.orderBy(...orderTerms)
		.limit(limit)
		.offset(offset);

	// Get stats for each narrator
	const items = await Promise.all(
		narratorsList.map(async (narrator) => {
			// Book stats (narratorId on books)
			const bookStatsResult = await db
				.select({
					count: sql<number>`count(*)`,
					avgRating: sql<number>`avg(CASE WHEN ${vub.rating} > 0 THEN ${vub.rating} ELSE NULL END)`
				})
				.from(books)
				.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
				.where(and(eq(books.narratorId, narrator.id), userLibraryCondition));

			return {
				...narrator,
				bookCount: bookStatsResult[0]?.count ?? 0,
				avgRating: bookStatsResult[0]?.avgRating ? parseFloat(bookStatsResult[0].avgRating.toFixed(1)) : null
			};
		})
	);

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

		// Get a representative cover book for each narrator, from the books the viewer can see
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
					sql`${books.coverImageUrl} IS NOT NULL AND ${books.coverImageUrl} != ''`,
					userLibraryCondition
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
			(item as NarratorListItem).tags = tagsByNarrator.get(item.id) || [];
			(item as NarratorListItem).coverBook = coverBookByNarrator.get(item.id) || null;
		}
	}

	return { items, total, page, limit };
}

/** Null when the narrator doesn't exist or narrates no book the viewer can see, so callers 404 alike */
export async function getNarratorById(id: number, viewer: Viewer): Promise<NarratorWithStats | null> {
	if (!(await canReachEntity(viewer, 'narrator', id))) return null;
	const userId = viewer?.id;
	const narrator = await db.select().from(narrators).where(eq(narrators.id, id)).limit(1);
	if (!narrator[0]) return null;

	// Stats count the books the viewer can see
	const userLibraryCondition = reachableBookCond(viewer, 'books');

	// Book stats
	const bookStatsResult = await db
		.select({
			count: sql<number>`count(*)`,
			avgRating: sql<number>`avg(CASE WHEN ${vub.rating} > 0 THEN ${vub.rating} ELSE NULL END)`
		})
		.from(books)
		.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
		.where(and(eq(books.narratorId, id), userLibraryCondition));

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
		avgRating: bookStatsResult[0]?.avgRating ? parseFloat(bookStatsResult[0].avgRating.toFixed(1)) : null,
		tags: narratorTags2
	};
}

export async function getNarratorByName(name: string): Promise<NarratorType | null> {
	const narrator = await db.select().from(narrators).where(eq(narrators.name, name)).limit(1);
	return narrator[0] || null;
}

// Existing narrator sharing the duplicate name key ('R.C. Bray' finds 'R. C. Bray'); lowest id wins, like findOrCreateNarratorByName
export async function findNarratorByNameKey(name: string): Promise<{ id: number; name: string } | null> {
	const key = duplicateNameKey(name.trim());
	const rows = await db.select({ id: narrators.id, name: narrators.name }).from(narrators).orderBy(asc(narrators.id));
	return rows.find((r) => duplicateNameKey(r.name) === key) ?? null;
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

// Lookup by the duplicate name key ('R.C. Bray' reuses 'R. C. Bray', lowest id wins); creates the narrator if missing. Empty name returns null.
export async function findOrCreateNarratorByName(name: string): Promise<number | null> {
	const trimmed = name.trim();
	const key = duplicateNameKey(trimmed);
	if (!key) return null;
	const rows = await db.select({ id: narrators.id, name: narrators.name }).from(narrators).orderBy(asc(narrators.id));
	const existing = rows.find((r) => duplicateNameKey(r.name ?? '') === key);
	if (existing) return existing.id;
	const created = await createNarrator({ name: trimmed });
	return created.id;
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

	const totalUsage = bookCount[0]?.count ?? 0;
	if (totalUsage > 0) {
		throw new Error(`Cannot delete narrator: ${totalUsage} book(s) assigned. Please reassign or delete those books first.`);
	}

	// Delete tags first
	await db.delete(narratorTags).where(eq(narratorTags.narratorId, id));

	const result = await db.delete(narrators).where(eq(narrators.id, id));
	return result.changes > 0;
}

// Get books by a narrator: the books the viewer can see
export async function getBooksByNarrator(narratorId: number, viewer: Viewer): Promise<{ id: number; title: string; coverImageUrl: string | null; rating: number | null }[]> {
	const userId = viewer?.id;
	const userLibraryCondition = reachableBookCond(viewer, 'books');

	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl,
			rating: vub.rating
		})
		.from(books)
		.leftJoin(vub, and(eq(vub.bookId, books.id), eq(vub.userId, userId ?? -1)))
		.where(and(eq(books.narratorId, narratorId), userLibraryCondition))
		.orderBy(asc(books.title));
}

// Get the narrators the viewer can see, for dropdowns
export async function getAllNarrators(viewer: Viewer): Promise<{ id: number; name: string }[]> {
	return db
		.select({
			id: narrators.id,
			name: narrators.name
		})
		.from(narrators)
		.where(reachableEntityCond(viewer, 'narrator', sql`${narrators.id}`))
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
// Duplicate Cleanup
// ============================================

/**
 * Find potential duplicate narrators
 */
export async function findDuplicateNarrators(): Promise<
	Array<{ name: string; narrators: { id: number; name: string; bookCount: number }[] }>
> {
	// Get ignored pairs
	const { getIgnoredPairs } = await import('./ignoredDuplicatesService');
	const ignoredPairs = await getIgnoredPairs('narrator');

	// Ties on name fall back to the oldest id, so the default keeper is deterministic
	const allNarrators = await db
		.select({
			id: narrators.id,
			name: narrators.name,
			bookCount: sql<number>`(SELECT COUNT(*) FROM books WHERE books.narratorId = narrators.id)`
		})
		.from(narrators)
		.orderBy(narrators.name, narrators.id);

	// Group by normalized name
	const groups = new Map<string, Array<{ id: number; name: string; bookCount: number }>>();

	for (const narrator of allNarrators) {
		const normalized = duplicateNameKey(narrator.name);

		if (!groups.has(normalized)) {
			groups.set(normalized, []);
		}
		groups.get(normalized)!.push(narrator);
	}

	// Return only groups with duplicates, filtering out ignored pairs
	const duplicates: Array<{
		name: string;
		narrators: { id: number; name: string; bookCount: number }[];
	}> = [];

	groups.forEach((narratorList) => {
		if (narratorList.length > 1) {
			// Filter out narrators where all pairs are ignored
			const nonIgnoredNarrators = filterIgnoredPairs(narratorList, ignoredPairs);
			if (nonIgnoredNarrators.length > 1) {
				// Label the group with a real name; the grouping key is not display text
				duplicates.push({ name: nonIgnoredNarrators[0].name, narrators: nonIgnoredNarrators });
			}
		}
	});

	return duplicates;
}

/**
 * Filter out items where all pairs in the group are ignored
 */
function filterIgnoredPairs<T extends { id: number }>(items: T[], ignoredPairs: Set<string>): T[] {
	if (items.length <= 1) return items;

	// Check if ALL pairs in this group are ignored
	let hasNonIgnoredPair = false;
	for (let i = 0; i < items.length && !hasNonIgnoredPair; i++) {
		for (let j = i + 1; j < items.length; j++) {
			const pairKey = `${items[i].id}-${items[j].id}`;
			if (!ignoredPairs.has(pairKey)) {
				hasNonIgnoredPair = true;
				break;
			}
		}
	}

	// If all pairs are ignored, return empty (don't show this group)
	if (!hasNonIgnoredPair) {
		return [];
	}

	return items;
}

/**
 * Merge a duplicate narrator into the keeper: repoint its books, carry its tags without
 * doubling a pair (narratortags has no unique index), then delete it. All writes run in one
 * transaction; a failure inside it throws and leaves everything as it was.
 */
export async function mergeNarrators(
	targetId: number,
	sourceId: number
): Promise<{ success: boolean; merged: number; error?: string }> {
	if (targetId === sourceId) {
		return { success: false, merged: 0, error: 'Cannot merge narrator with itself' };
	}

	const [target] = await db.select({ id: narrators.id }).from(narrators).where(eq(narrators.id, targetId));
	if (!target) {
		return { success: false, merged: 0, error: 'Target narrator not found' };
	}

	const [source] = await db.select({ id: narrators.id }).from(narrators).where(eq(narrators.id, sourceId));
	if (!source) {
		return { success: false, merged: 0, error: 'Source narrator not found' };
	}

	const now = new Date().toISOString();

	const merged = db.transaction((tx) => {
		// Repoint books before the delete: books.narratorId has no ON DELETE, so the delete would fail
		const result = tx.update(books).set({ narratorId: targetId }).where(eq(books.narratorId, sourceId)).run();

		const keeperTagIds = new Set(
			tx
				.select({ tagId: narratorTags.tagId })
				.from(narratorTags)
				.where(eq(narratorTags.narratorId, targetId))
				.all()
				.map((r) => r.tagId)
		);
		const sourceTags = tx
			.select({ tagId: narratorTags.tagId })
			.from(narratorTags)
			.where(eq(narratorTags.narratorId, sourceId))
			.all();

		for (const { tagId } of sourceTags) {
			if (keeperTagIds.has(tagId)) continue;
			tx.insert(narratorTags).values({ narratorId: targetId, tagId, createdAt: now, updatedAt: now }).run();
			// The source may hold the same tag twice
			keeperTagIds.add(tagId);
		}

		tx.delete(narratorTags).where(eq(narratorTags.narratorId, sourceId)).run();
		tx.delete(narrators).where(eq(narrators.id, sourceId)).run();

		return result.changes;
	});

	return { success: true, merged };
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
			description: stripHtmlTags(result.snippet),
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
