import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, genreId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// genreId can be null to clear the genre
	if (genreId !== null && typeof genreId !== 'number') {
		throw error(400, 'genreId must be a number or null');
	}

	const now = new Date().toISOString();

	// Update all books in one query
	await db
		.update(books)
		.set({
			genreId,
			updatedAt: now
		})
		.where(inArray(books.id, bookIds));

	return json({
		success: true,
		updated: bookIds.length,
		message: genreId
			? `Genre set for ${bookIds.length} book(s)`
			: `Genre cleared from ${bookIds.length} book(s)`
	});
};
