import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, narratorId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// narratorId can be null to clear the narrator
	if (narratorId !== null && typeof narratorId !== 'number') {
		throw error(400, 'narratorId must be a number or null');
	}

	const now = new Date().toISOString();

	// Update all books in one query
	await db
		.update(books)
		.set({
			narratorId,
			updatedAt: now
		})
		.where(inArray(books.id, bookIds));

	return json({
		success: true,
		updated: bookIds.length,
		message: narratorId
			? `Narrator set for ${bookIds.length} book(s)`
			: `Narrator cleared from ${bookIds.length} book(s)`
	});
};
