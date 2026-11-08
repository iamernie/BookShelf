import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { inArray } from 'drizzle-orm';
import { db, books } from '$lib/server/db';
import { applyStatusChange } from '$lib/server/services/statusService';
import { canReachBook } from '$lib/server/services/libraryShareService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, statusId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	if (typeof statusId !== 'number') {
		throw error(400, 'statusId must be a number');
	}

	// Status is the caller's own reading record: any book they can reach, as PUT /api/books/[id]
	// for personal fields; unreachable or unknown ids are skipped
	const ids: number[] = [...new Set(bookIds.filter((id): id is number => Number.isInteger(id)))];
	const rows = ids.length > 0
		? await db.select({ id: books.id }).from(books).where(inArray(books.id, ids))
		: [];
	const known = new Set(rows.map((r) => r.id));

	const allowed: number[] = [];
	const skipped: number[] = [];
	for (const id of ids) {
		const permitted = known.has(id) && await canReachBook(locals.user.id, id);
		(permitted ? allowed : skipped).push(id);
	}

	// Books already in this status are left alone (no re-stamping, no repeat notifications)
	if (allowed.length > 0) {
		await applyStatusChange(allowed, statusId, { source: 'bulk', userId: locals.user.id });
	}

	return json({
		success: true,
		updated: allowed.length,
		skipped,
		message: skipped.length > 0
			? `Status updated for ${allowed.length} book(s); ${skipped.length} skipped (no permission or not found)`
			: `Status updated for ${allowed.length} book(s)`
	});
};
