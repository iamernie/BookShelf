import { db, statuses, books } from '$lib/server/db';
import { eq, asc, sql } from 'drizzle-orm';

// Infer Status type from schema
type StatusType = typeof statuses.$inferSelect;

export interface StatusWithCount extends StatusType {
	bookCount: number;
}

export async function getStatuses(): Promise<StatusWithCount[]> {
	// Get all statuses
	const statusList = await db
		.select()
		.from(statuses)
		.orderBy(asc(statuses.sortOrder), asc(statuses.name));

	// Get book counts for each status
	const items = await Promise.all(
		statusList.map(async (status) => {
			const countResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(books)
				.where(eq(books.statusId, status.id));

			return {
				...status,
				bookCount: countResult[0]?.count ?? 0
			};
		})
	);

	return items;
}

export async function getStatusById(id: number): Promise<StatusWithCount | null> {
	const status = await db.select().from(statuses).where(eq(statuses.id, id)).limit(1);
	if (!status[0]) return null;

	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(eq(books.statusId, id));

	return {
		...status[0],
		bookCount: countResult[0]?.count ?? 0
	};
}

// Only allow updating the name (for localization) - statuses are system-defined
export async function updateStatusName(id: number, name: string): Promise<StatusType | null> {
	const now = new Date().toISOString();

	const [updated] = await db
		.update(statuses)
		.set({ name, updatedAt: now })
		.where(eq(statuses.id, id))
		.returning();

	return updated || null;
}

// Get books with a specific status
export async function getBooksByStatus(statusId: number): Promise<{ id: number; title: string; coverImageUrl: string | null }[]> {
	return db
		.select({
			id: books.id,
			title: books.title,
			coverImageUrl: books.coverImageUrl
		})
		.from(books)
		.where(eq(books.statusId, statusId))
		.orderBy(asc(books.title));
}

// Get all statuses for dropdowns
export async function getAllStatuses(): Promise<{ id: number; name: string; color: string | null; icon: string | null }[]> {
	return db
		.select({
			id: statuses.id,
			name: statuses.name,
			color: statuses.color,
			icon: statuses.icon
		})
		.from(statuses)
		.orderBy(asc(statuses.sortOrder), asc(statuses.name));
}

// Get status by key (READ, CURRENT, NEXT, DNF, WISHLIST, PARKED)
export async function getStatusByKey(key: string): Promise<StatusType | null> {
	const [status] = await db
		.select()
		.from(statuses)
		.where(eq(statuses.key, key))
		.limit(1);
	return status || null;
}
