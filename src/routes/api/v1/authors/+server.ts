/**
 * API v1 Authors Endpoint
 * Returns all authors with book counts
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, authors, bookAuthors } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);

	try {
		// Get total count
		const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(authors);

		// Get authors with book counts
		const authorsList = await db.select({
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
		})
			.from(authors)
			.orderBy(desc(sql`bookCount`))
			.limit(limit)
			.offset(offset);

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
