import { db, userSeriesNotes, userAuthorNotes, userNarratorNotes } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import type { EntityKind } from '$lib/server/services/libraryShareService';

/**
 * Per-user notes on a series, author or narrator (2.31.0). Each user writes and sees only their
 * own; every read and write is keyed on (userId, entityId). One service drives the three tables.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const NOTES = {
	series: { table: userSeriesNotes, fk: userSeriesNotes.seriesId },
	author: { table: userAuthorNotes, fk: userAuthorNotes.authorId },
	narrator: { table: userNarratorNotes, fk: userNarratorNotes.narratorId }
} as const;

// Each table names its entity column differently; the insert needs the key
const FK_KEY = { series: 'seriesId', author: 'authorId', narrator: 'narratorId' } as const;

function notesOf(kind: EntityKind) {
	const { table, fk } = NOTES[kind];
	// The three tables share every column but the fk; one shape keeps the queries typed
	return { table: table as typeof userSeriesNotes, fk: fk as typeof userSeriesNotes.seriesId };
}

/** The viewer's own note on the entity, or null */
export async function getEntityNotes(viewerId: number, kind: EntityKind, entityId: number): Promise<string | null> {
	const { table, fk } = notesOf(kind);
	const row = await db
		.select({ notes: table.notes })
		.from(table)
		.where(and(eq(table.userId, viewerId), eq(fk, entityId)))
		.get();
	return row?.notes ?? null;
}

/** The viewer's own notes on several entities of one kind, keyed by entity id */
export async function getEntityNotesMap(
	viewerId: number,
	kind: EntityKind,
	entityIds: number[]
): Promise<Record<number, string>> {
	if (entityIds.length === 0) return {};
	const { table, fk } = notesOf(kind);
	const rows = await db
		.select({ entityId: fk, notes: table.notes })
		.from(table)
		.where(and(eq(table.userId, viewerId), inArray(fk, entityIds)))
		.all();
	return Object.fromEntries(rows.map((r) => [r.entityId, r.notes]));
}

/** Save the viewer's own note: trimmed, and an empty value deletes the row. Returns the stored text */
export async function putEntityNotes(
	viewerId: number,
	kind: EntityKind,
	entityId: number,
	notes: string | null
): Promise<string | null> {
	const { table, fk } = notesOf(kind);
	const text = (notes ?? '').trim();
	const mine = and(eq(table.userId, viewerId), eq(fk, entityId));

	if (!text) {
		await db.delete(table).where(mine);
		return null;
	}

	const now = new Date().toISOString();
	await db
		.insert(table)
		.values({ userId: viewerId, [FK_KEY[kind]]: entityId, notes: text, createdAt: now, updatedAt: now } as typeof userSeriesNotes.$inferInsert)
		.onConflictDoUpdate({ target: [table.userId, fk], set: { notes: text, updatedAt: now } });
	return text;
}

/**
 * Merge helper: move every user's notes from sourceId to targetId inside the caller's
 * transaction, before the source is deleted (the cascade would drop them). Where a user has a
 * note on both, the target keeps its text, a blank line, then the source text. Returns rows moved
 * or folded in.
 */
export function repointAndConcatEntityNotes(tx: Tx, kind: EntityKind, sourceId: number, targetId: number): number {
	if (sourceId === targetId) return 0;
	const { table, fk } = notesOf(kind);
	const now = new Date().toISOString();
	const sourceRows = tx.select().from(table).where(eq(fk, sourceId)).all();

	for (const src of sourceRows) {
		const existing = tx
			.select({ id: table.id, notes: table.notes })
			.from(table)
			.where(and(eq(table.userId, src.userId), eq(fk, targetId)))
			.get();
		if (existing) {
			tx.update(table)
				.set({ notes: `${existing.notes}\n\n${src.notes}`, updatedAt: now })
				.where(eq(table.id, existing.id))
				.run();
			tx.delete(table).where(eq(table.id, src.id)).run();
		} else {
			tx.update(table)
				.set({ [FK_KEY[kind]]: targetId, updatedAt: now } as Partial<typeof userSeriesNotes.$inferInsert>)
				.where(eq(table.id, src.id))
				.run();
		}
	}
	return sourceRows.length;
}
