/**
 * API v1 Authors Endpoint
 * CRUD operations for authors
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { createAuthor } from '$lib/server/services/authorService';
import { db, authors, bookAuthors } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

// Helper to validate token and check API enabled
async function validateRequest(token: string | null): Promise<{ valid: boolean; error?: string; status?: number }> {
	if (!(await areWidgetsEnabled())) {
		return { valid: false, error: 'API is disabled', status: 403 };
	}
	if (!token || !(await validateWidgetToken(token))) {
		return { valid: false, error: 'Invalid or missing API token', status: 401 };
	}
	return { valid: true };
}

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const search = url.searchParams.get('search')?.trim();

	try {
		// Build where condition for search
		const whereCondition = search
			? sql`LOWER(${authors.name}) LIKE LOWER(${'%' + search + '%'})`
			: undefined;

		// Get total count
		const [countResult] = whereCondition
			? await db.select({ count: sql<number>`count(*)` }).from(authors).where(whereCondition)
			: await db.select({ count: sql<number>`count(*)` }).from(authors);

		// Get authors with book counts
		const query = db.select({
			id: authors.id,
			name: authors.name,
			bio: authors.bio,
			birthDate: authors.birthDate,
			deathDate: authors.deathDate,
			birthPlace: authors.birthPlace,
			photoUrl: authors.photoUrl,
			website: authors.website,
			wikipediaUrl: authors.wikipediaUrl,
			comments: authors.comments,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
			bookCount: sql<number>`(SELECT COUNT(DISTINCT ${bookAuthors.bookId}) FROM ${bookAuthors} WHERE ${bookAuthors.authorId} = ${authors.id})`
		}).from(authors);

		// Define the book count expression for reuse in orderBy
		const bookCountExpr = sql<number>`(SELECT COUNT(DISTINCT ${bookAuthors.bookId}) FROM ${bookAuthors} WHERE ${bookAuthors.authorId} = ${authors.id})`;

		const authorsList = whereCondition
			? await query.where(whereCondition).orderBy(desc(bookCountExpr)).limit(limit).offset(offset)
			: await query.orderBy(desc(bookCountExpr)).limit(limit).offset(offset);

		return json({
			authors: authorsList,
			pagination: {
				total: countResult?.count ?? 0,
				limit,
				offset,
				hasMore: offset + limit < (countResult?.count ?? 0)
			}
		});
	} catch (err) {
		console.error('API v1 authors error:', err);
		return json({ error: 'Failed to fetch authors' }, { status: 500 });
	}
};

/**
 * POST /api/v1/authors - Create a new author
 */
export const POST: RequestHandler = async ({ url, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	try {
		const body = await request.json();

		if (!body.name) {
			return json({ error: 'name is required' }, { status: 400 });
		}

		const newAuthor = await createAuthor({
			name: body.name,
			bio: body.bio,
			birthDate: body.birthDate,
			deathDate: body.deathDate,
			birthPlace: body.birthPlace,
			photoUrl: body.photoUrl,
			website: body.website,
			wikipediaUrl: body.wikipediaUrl,
			comments: body.comments
		});

		return json({
			author: { id: newAuthor.id, name: newAuthor.name },
			message: 'Author created successfully'
		}, { status: 201 });
	} catch (err) {
		console.error('API v1 create author error:', err);
		return json({ error: 'Failed to create author' }, { status: 500 });
	}
};
