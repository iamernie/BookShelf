import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books } from '$lib/server/db';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds, formatId } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// formatId can be null to clear the format
	if (formatId !== null && typeof formatId !== 'number') {
		throw error(400, 'formatId must be a number or null');
	}

	const now = new Date().toISOString();

	// Update all books in one query
	await db
		.update(books)
		.set({
			formatId,
			updatedAt: now
		})
		.where(inArray(books.id, bookIds));

	return json({
		success: true,
		updated: bookIds.length,
		message: formatId
			? `Format set for ${bookIds.length} book(s)`
			: `Format cleared from ${bookIds.length} book(s)`
	});
};
