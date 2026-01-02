import { db, magicShelves, books, bookAuthors, bookSeries, bookTags, authors, series, tags, statuses, genres, formats, narrators } from '$lib/server/db';
import type { MagicShelf, NewMagicShelf, Book } from '$lib/server/db/schema';
import { eq, and, or, like, gt, lt, gte, lte, isNull, isNotNull, inArray, notInArray, sql, desc, asc, type SQL } from 'drizzle-orm';

// ============================================
// Filter Rule Types
// ============================================

export type FilterOperator =
	| 'equals'
	| 'not_equals'
	| 'contains'
	| 'not_contains'
	| 'greater_than'
	| 'less_than'
	| 'greater_or_equal'
	| 'less_or_equal'
	| 'between'
	| 'is_null'
	| 'is_not_null'
	| 'in'
	| 'not_in';

export interface FilterRule {
	field: string;
	operator: FilterOperator;
	value: string | number | string[] | number[] | null;
}

export interface FilterGroup {
	logic: 'AND' | 'OR';
	rules: (FilterRule | FilterGroup)[];
}

export type FilterConfig = FilterRule | FilterGroup;

// Field definitions for UI
export const FILTERABLE_FIELDS = [
	{ field: 'title', label: 'Title', type: 'text' },
	{ field: 'statusId', label: 'Status', type: 'select', relation: 'statuses' },
	{ field: 'genreId', label: 'Genre', type: 'select', relation: 'genres' },
	{ field: 'formatId', label: 'Format', type: 'select', relation: 'formats' },
	{ field: 'rating', label: 'Rating', type: 'number', min: 0, max: 5 },
	{ field: 'pageCount', label: 'Page Count', type: 'number' },
	{ field: 'publishYear', label: 'Publish Year', type: 'number' },
	{ field: 'authorId', label: 'Author', type: 'select', relation: 'authors' },
	{ field: 'seriesId', label: 'Series', type: 'select', relation: 'series' },
	{ field: 'tagId', label: 'Tag', type: 'select', relation: 'tags' },
	{ field: 'narratorId', label: 'Narrator', type: 'select', relation: 'narrators' },
	{ field: 'completedDate', label: 'Completed Date', type: 'date' },
	{ field: 'startReadingDate', label: 'Start Reading Date', type: 'date' },
	{ field: 'releaseDate', label: 'Release Date', type: 'date' },
	{ field: 'createdAt', label: 'Date Added', type: 'date' },
	{ field: 'ebookPath', label: 'Has Ebook', type: 'boolean' },
	{ field: 'hasAudiobook', label: 'Has Audiobook', type: 'boolean' },
	{ field: 'coverImageUrl', label: 'Has Cover', type: 'boolean' },
	{ field: 'isbn13', label: 'ISBN-13', type: 'text' },
	{ field: 'language', label: 'Language', type: 'text' },
	{ field: 'publisher', label: 'Publisher', type: 'text' }
] as const;

// Operators available per field type
export const OPERATORS_BY_TYPE = {
	text: ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'is_not_null'],
	number: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'is_null', 'is_not_null'],
	select: ['equals', 'not_equals', 'in', 'not_in', 'is_null', 'is_not_null'],
	date: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'is_null', 'is_not_null'],
	boolean: ['is_null', 'is_not_null']
} as const;

// ============================================
// Magic Shelf CRUD
// ============================================

export async function getAllShelves(userId?: number): Promise<MagicShelf[]> {
	// Only return shelves owned by the user (no public sharing of shelves between users)
	if (!userId) {
		return [];
	}

	return db
		.select()
		.from(magicShelves)
		.where(eq(magicShelves.userId, userId))
		.orderBy(asc(magicShelves.displayOrder), asc(magicShelves.name));
}

export async function getShelfById(id: number): Promise<MagicShelf | null> {
	const result = await db
		.select()
		.from(magicShelves)
		.where(eq(magicShelves.id, id))
		.limit(1);

	return result[0] || null;
}

export async function createShelf(data: {
	name: string;
	description?: string;
	icon?: string;
	iconColor?: string;
	filterJson: FilterConfig;
	sortField?: string;
	sortOrder?: string;
	isPublic?: boolean;
	userId: number;
}): Promise<MagicShelf> {
	const now = new Date().toISOString();

	const result = await db.insert(magicShelves).values({
		name: data.name,
		description: data.description,
		icon: data.icon || 'bookmark',
		iconColor: data.iconColor || '#6c757d',
		filterJson: JSON.stringify(data.filterJson),
		sortField: data.sortField || 'title',
		sortOrder: data.sortOrder || 'asc',
		isPublic: data.isPublic || false,
		userId: data.userId,
		createdAt: now,
		updatedAt: now
	}).returning();

	return result[0];
}

export async function updateShelf(id: number, data: Partial<{
	name: string;
	description: string;
	icon: string;
	iconColor: string;
	filterJson: FilterConfig;
	sortField: string;
	sortOrder: string;
	isPublic: boolean;
	displayOrder: number;
}>): Promise<MagicShelf | null> {
	const updateData: Record<string, unknown> = {
		updatedAt: new Date().toISOString()
	};

	if (data.name !== undefined) updateData.name = data.name;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.icon !== undefined) updateData.icon = data.icon;
	if (data.iconColor !== undefined) updateData.iconColor = data.iconColor;
	if (data.filterJson !== undefined) updateData.filterJson = JSON.stringify(data.filterJson);
	if (data.sortField !== undefined) updateData.sortField = data.sortField;
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
	if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
	if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

	const result = await db
		.update(magicShelves)
		.set(updateData)
		.where(eq(magicShelves.id, id))
		.returning();

	return result[0] || null;
}

export async function deleteShelf(id: number): Promise<boolean> {
	const result = await db.delete(magicShelves).where(eq(magicShelves.id, id));
	return true;
}

// ============================================
// Query Building & Execution
// ============================================

function isFilterGroup(rule: FilterRule | FilterGroup): rule is FilterGroup {
	return 'logic' in rule && 'rules' in rule;
}

// Map of valid book columns for filtering
const BOOK_COLUMNS: Record<string, keyof typeof books> = {
	title: 'title',
	statusId: 'statusId',
	genreId: 'genreId',
	formatId: 'formatId',
	rating: 'rating',
	pageCount: 'pageCount',
	publishYear: 'publishYear',
	narratorId: 'narratorId',
	completedDate: 'completedDate',
	startReadingDate: 'startReadingDate',
	releaseDate: 'releaseDate',
	createdAt: 'createdAt',
	ebookPath: 'ebookPath',
	coverImageUrl: 'coverImageUrl',
	isbn13: 'isbn13',
	language: 'language',
	publisher: 'publisher'
};

// Resolve dynamic date values like $today
function resolveDateValue(value: string | number | string[] | number[] | null): string | number | string[] | number[] | null {
	if (value === '$today') {
		// Return today's date in YYYY-MM-DD format
		return new Date().toISOString().split('T')[0];
	}
	return value;
}

function buildCondition(rule: FilterRule): SQL<unknown> | null {
	const { field, operator } = rule;
	// Resolve dynamic date values
	const value = resolveDateValue(rule.value);

	// Handle junction table fields (author, series, tag)
	if (field === 'authorId' || field === 'seriesId' || field === 'tagId') {
		// These need special handling via subqueries
		return null;
	}

	// Handle hasAudiobook virtual field - checks if book has linked audiobook
	if (field === 'hasAudiobook') {
		if (operator === 'is_not_null') {
			// Books that HAVE an audiobook
			return sql`${books.id} IN (SELECT bookId FROM audiobooks WHERE bookId IS NOT NULL)`;
		} else if (operator === 'is_null') {
			// Books that DON'T have an audiobook
			return sql`${books.id} NOT IN (SELECT bookId FROM audiobooks WHERE bookId IS NOT NULL)`;
		}
		return null;
	}

	// Get the column reference
	const columnName = BOOK_COLUMNS[field];
	if (!columnName) return null;

	const column = books[columnName];
	if (!column) return null;

	switch (operator) {
		case 'equals':
			return sql`${column} = ${value}`;
		case 'not_equals':
			return sql`${column} != ${value}`;
		case 'contains':
			return sql`${column} LIKE ${'%' + value + '%'}`;
		case 'not_contains':
			return sql`${column} NOT LIKE ${'%' + value + '%'}`;
		case 'greater_than':
			return sql`${column} > ${value}`;
		case 'less_than':
			return sql`${column} < ${value}`;
		case 'greater_or_equal':
			return sql`${column} >= ${value}`;
		case 'less_or_equal':
			return sql`${column} <= ${value}`;
		case 'is_null':
			return sql`${column} IS NULL`;
		case 'is_not_null':
			return sql`${column} IS NOT NULL`;
		case 'in':
			if (Array.isArray(value) && value.length > 0) {
				// Use SQL template for IN clause
				const inPlaceholders = value.map((_, i) => sql`${value[i]}`);
				return sql`${column} IN (${sql.join(inPlaceholders, sql`, `)})`;
			}
			return null;
		case 'not_in':
			if (Array.isArray(value) && value.length > 0) {
				const notInPlaceholders = value.map((_, i) => sql`${value[i]}`);
				return sql`${column} NOT IN (${sql.join(notInPlaceholders, sql`, `)})`;
			}
			return null;
		case 'between':
			if (Array.isArray(value) && value.length === 2) {
				return sql`${column} BETWEEN ${value[0]} AND ${value[1]}`;
			}
			return null;
		default:
			return null;
	}
}

function buildWhereClause(config: FilterConfig): SQL<unknown> | null {
	if (isFilterGroup(config)) {
		const conditions = config.rules
			.map(rule => buildWhereClause(rule))
			.filter((c): c is SQL<unknown> => c !== null);

		if (conditions.length === 0) return null;
		if (conditions.length === 1) return conditions[0];

		const combined = config.logic === 'AND' ? and(...conditions) : or(...conditions);
		return combined ?? null;
	}

	return buildCondition(config);
}

// Get book IDs that have specific junction table relations
async function getBookIdsWithRelation(
	field: 'authorId' | 'seriesId' | 'tagId',
	operator: FilterOperator,
	value: number | number[]
): Promise<number[]> {
	let table;
	let foreignKey;

	switch (field) {
		case 'authorId':
			table = bookAuthors;
			foreignKey = bookAuthors.authorId;
			break;
		case 'seriesId':
			table = bookSeries;
			foreignKey = bookSeries.seriesId;
			break;
		case 'tagId':
			table = bookTags;
			foreignKey = bookTags.tagId;
			break;
	}

	let whereCondition;
	const values = Array.isArray(value) ? value : [value];

	switch (operator) {
		case 'equals':
		case 'in':
			whereCondition = inArray(foreignKey, values);
			break;
		case 'not_equals':
		case 'not_in':
			// Return all book IDs that don't have this relation
			const booksWithRelation = await db
				.selectDistinct({ bookId: table.bookId })
				.from(table)
				.where(inArray(foreignKey, values));

			const excludeIds = booksWithRelation.map(b => b.bookId);
			if (excludeIds.length === 0) {
				// No books have this relation, return all book IDs
				const allBooks = await db.select({ id: books.id }).from(books);
				return allBooks.map(b => b.id);
			}

			const booksWithout = await db
				.select({ id: books.id })
				.from(books)
				.where(notInArray(books.id, excludeIds));

			return booksWithout.map(b => b.id);
		default:
			return [];
	}

	const result = await db
		.selectDistinct({ bookId: table.bookId })
		.from(table)
		.where(whereCondition);

	return result.map(r => r.bookId);
}

// Extract junction table rules and get applicable book IDs
async function processJunctionRules(config: FilterConfig): Promise<{
	includeBookIds: number[] | null;
	excludeBookIds: number[];
}> {
	const junctionFields = ['authorId', 'seriesId', 'tagId'];
	let includeBookIds: number[] | null = null;
	const excludeBookIds: number[] = [];

	function extractJunctionRules(cfg: FilterConfig): FilterRule[] {
		if (isFilterGroup(cfg)) {
			return cfg.rules.flatMap(r => extractJunctionRules(r));
		}
		if (junctionFields.includes(cfg.field)) {
			return [cfg];
		}
		return [];
	}

	const junctionRules = extractJunctionRules(config);

	for (const rule of junctionRules) {
		const bookIds = await getBookIdsWithRelation(
			rule.field as 'authorId' | 'seriesId' | 'tagId',
			rule.operator,
			rule.value as number | number[]
		);

		if (rule.operator === 'not_equals' || rule.operator === 'not_in') {
			excludeBookIds.push(...bookIds.filter(id => !excludeBookIds.includes(id)));
		} else {
			if (includeBookIds === null) {
				includeBookIds = bookIds;
			} else {
				// Intersect with existing
				includeBookIds = includeBookIds.filter(id => bookIds.includes(id));
			}
		}
	}

	return { includeBookIds, excludeBookIds };
}

export interface ShelfBooksResult {
	books: Book[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export async function getShelfBooks(
	shelfId: number,
	options: { page?: number; limit?: number; userId?: number } = {}
): Promise<ShelfBooksResult | null> {
	const shelf = await getShelfById(shelfId);
	if (!shelf) return null;

	const page = options.page || 1;
	const limit = options.limit || 24;
	const offset = (page - 1) * limit;
	const userId = options.userId || shelf.userId;

	let filterConfig: FilterConfig;
	try {
		filterConfig = JSON.parse(shelf.filterJson);
	} catch {
		filterConfig = { logic: 'AND', rules: [] };
	}

	// Build where clause from non-junction rules
	const whereClause = buildWhereClause(filterConfig);

	// Process junction table rules
	const { includeBookIds, excludeBookIds } = await processJunctionRules(filterConfig);

	// Build final conditions
	const conditions: ReturnType<typeof eq>[] = [];

	// Only include books in user's personal library (user_books table)
	if (userId) {
		conditions.push(
			sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		);
	} else {
		// No user - return nothing
		return { books: [], total: 0, page, limit, totalPages: 0 };
	}

	if (whereClause) conditions.push(whereClause);
	if (includeBookIds !== null && includeBookIds.length > 0) {
		conditions.push(inArray(books.id, includeBookIds));
	}
	if (includeBookIds !== null && includeBookIds.length === 0) {
		// No books match junction criteria
		return { books: [], total: 0, page, limit, totalPages: 0 };
	}
	if (excludeBookIds.length > 0) {
		conditions.push(notInArray(books.id, excludeBookIds));
	}

	const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;

	// Get sort configuration
	const sortField = shelf.sortField || 'title';
	const sortOrder = shelf.sortOrder || 'asc';

	// Get sort column - use explicit mapping to avoid type issues
	let sortColumn;
	switch (sortField) {
		case 'rating': sortColumn = books.rating; break;
		case 'completedDate': sortColumn = books.completedDate; break;
		case 'createdAt': sortColumn = books.createdAt; break;
		case 'pageCount': sortColumn = books.pageCount; break;
		case 'publishYear': sortColumn = books.publishYear; break;
		default: sortColumn = books.title;
	}
	const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(finalWhere);

	const total = countResult[0]?.count || 0;

	// Get books
	const result = await db
		.select()
		.from(books)
		.where(finalWhere)
		.orderBy(orderBy)
		.limit(limit)
		.offset(offset);

	return {
		books: result,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit)
	};
}

export async function getShelfBookCount(shelfId: number): Promise<number> {
	const result = await getShelfBooks(shelfId, { page: 1, limit: 1 });
	return result?.total || 0;
}

// Get book counts for multiple shelves efficiently
export async function getShelfBookCounts(shelfIds: number[]): Promise<Map<number, number>> {
	const counts = new Map<number, number>();

	// Process in parallel for efficiency
	await Promise.all(
		shelfIds.map(async (id) => {
			const count = await getShelfBookCount(id);
			counts.set(id, count);
		})
	);

	return counts;
}

// Preview filter results without saving
export async function previewFilter(
	filterConfig: FilterConfig,
	options: { page?: number; limit?: number; userId?: number } = {}
): Promise<ShelfBooksResult> {
	const page = options.page || 1;
	const limit = options.limit || 24;
	const offset = (page - 1) * limit;
	const userId = options.userId;

	const whereClause = buildWhereClause(filterConfig);
	const { includeBookIds, excludeBookIds } = await processJunctionRules(filterConfig);

	const conditions: ReturnType<typeof eq>[] = [];

	// Only include books in user's personal library (user_books table)
	if (userId) {
		conditions.push(
			sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		);
	} else {
		// No user - return nothing
		return { books: [], total: 0, page, limit, totalPages: 0 };
	}

	if (whereClause) conditions.push(whereClause);
	if (includeBookIds !== null && includeBookIds.length > 0) {
		conditions.push(inArray(books.id, includeBookIds));
	}
	if (includeBookIds !== null && includeBookIds.length === 0) {
		return { books: [], total: 0, page, limit, totalPages: 0 };
	}
	if (excludeBookIds.length > 0) {
		conditions.push(notInArray(books.id, excludeBookIds));
	}

	const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;

	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(finalWhere);

	const total = countResult[0]?.count || 0;

	const result = await db
		.select()
		.from(books)
		.where(finalWhere)
		.orderBy(asc(books.title))
		.limit(limit)
		.offset(offset);

	return {
		books: result,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit)
	};
}
