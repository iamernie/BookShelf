import { db, ignoredDuplicates } from '$lib/server/db';
import { eq, and, or } from 'drizzle-orm';

export type EntityType = 'author' | 'series' | 'book';

/**
 * Check if a pair of entities is marked as ignored (not duplicates)
 */
export async function isIgnoredPair(entityType: EntityType, id1: number, id2: number): Promise<boolean> {
	// Always store with smaller ID first for consistency
	const [entityId1, entityId2] = id1 < id2 ? [id1, id2] : [id2, id1];

	const [result] = await db
		.select()
		.from(ignoredDuplicates)
		.where(
			and(
				eq(ignoredDuplicates.entityType, entityType),
				eq(ignoredDuplicates.entityId1, entityId1),
				eq(ignoredDuplicates.entityId2, entityId2)
			)
		)
		.limit(1);

	return !!result;
}

/**
 * Get all ignored pairs for a specific entity type
 */
export async function getIgnoredPairs(entityType: EntityType): Promise<Set<string>> {
	const results = await db
		.select({
			entityId1: ignoredDuplicates.entityId1,
			entityId2: ignoredDuplicates.entityId2
		})
		.from(ignoredDuplicates)
		.where(eq(ignoredDuplicates.entityType, entityType));

	const pairs = new Set<string>();
	for (const r of results) {
		// Store both directions for easy lookup
		pairs.add(`${r.entityId1}-${r.entityId2}`);
		pairs.add(`${r.entityId2}-${r.entityId1}`);
	}
	return pairs;
}

/**
 * Mark a pair as ignored (not duplicates)
 */
export async function ignorePair(
	entityType: EntityType,
	id1: number,
	id2: number,
	userId?: number
): Promise<boolean> {
	// Always store with smaller ID first for consistency
	const [entityId1, entityId2] = id1 < id2 ? [id1, id2] : [id2, id1];

	try {
		await db.insert(ignoredDuplicates).values({
			entityType,
			entityId1,
			entityId2,
			createdAt: new Date().toISOString(),
			createdBy: userId || null
		});
		return true;
	} catch (e) {
		// Likely duplicate entry
		console.error('Failed to ignore pair:', e);
		return false;
	}
}

/**
 * Remove an ignored pair (allow it to show as duplicate again)
 */
export async function unignorePair(
	entityType: EntityType,
	id1: number,
	id2: number
): Promise<boolean> {
	const [entityId1, entityId2] = id1 < id2 ? [id1, id2] : [id2, id1];

	const result = await db
		.delete(ignoredDuplicates)
		.where(
			and(
				eq(ignoredDuplicates.entityType, entityType),
				eq(ignoredDuplicates.entityId1, entityId1),
				eq(ignoredDuplicates.entityId2, entityId2)
			)
		);

	return true;
}

/**
 * Get count of ignored pairs by entity type
 */
export async function getIgnoredCount(entityType: EntityType): Promise<number> {
	const results = await db
		.select()
		.from(ignoredDuplicates)
		.where(eq(ignoredDuplicates.entityType, entityType));

	return results.length;
}
