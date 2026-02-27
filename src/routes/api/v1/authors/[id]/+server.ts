/**
 * API v1 Single Author Endpoint
 * GET, PUT, DELETE operations for a single author
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { updateAuthor, deleteAuthor } from '$lib/server/services/authorService';
import { db, authors, books, bookAuthors, series, bookSeries, statuses } from '$lib/server/db';
import { eq } from 'drizzle-orm';

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

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const authorId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(authorId)) {
		return json({ error: 'Invalid author ID' }, { status: 400 });
	}

	try {
		const [author] = await db.select().from(authors).where(eq(authors.id, authorId)).limit(1);

		if (!author) {
			return json({ error: 'Author not found' }, { status: 404 });
		}

		// Get all books by this author
		const authorBooks = await db.select({
			bookId: bookAuthors.bookId,
			role: bookAuthors.role,
			isPrimary: bookAuthors.isPrimary
		})
			.from(bookAuthors)
			.where(eq(bookAuthors.authorId, authorId));

		// Get book details
		const bookDetails = await Promise.all(authorBooks.map(async (ab) => {
			const [book] = await db.select().from(books).where(eq(books.id, ab.bookId)).limit(1);
			if (!book) return null;

			const [bookSeriesData, statusData] = await Promise.all([
				db.select({
					id: series.id,
					title: series.title,
					bookNum: bookSeries.bookNum
				}).from(bookSeries)
					.innerJoin(series, eq(bookSeries.seriesId, series.id))
					.where(eq(bookSeries.bookId, book.id)),
				book.statusId ? db.select().from(statuses).where(eq(statuses.id, book.statusId)).limit(1) : Promise.resolve([])
			]);

			return {
				id: book.id,
				title: book.title,
				coverUrl: book.coverImageUrl,
				rating: book.rating,
				releaseDate: book.releaseDate,
				completedDate: book.completedDate,
				role: ab.role,
				isPrimary: ab.isPrimary,
				series: bookSeriesData[0] || null,
				status: statusData[0] ? {
					id: statusData[0].id,
					name: statusData[0].name,
					color: statusData[0].color
				} : null
			};
		}));

		return json({
			author: {
				id: author.id,
				name: author.name,
				bio: author.bio,
				birthDate: author.birthDate,
				deathDate: author.deathDate,
				birthPlace: author.birthPlace,
				photoUrl: author.photoUrl,
				website: author.website,
				wikipediaUrl: author.wikipediaUrl,
				comments: author.comments,
				createdAt: author.createdAt,
				updatedAt: author.updatedAt
			},
			books: bookDetails.filter(Boolean)
		});
	} catch (err) {
		console.error('API v1 author error:', err);
		return json({ error: 'Failed to fetch author' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/authors/[id] - Update an author
 */
export const PUT: RequestHandler = async ({ params, url, request }) => {
	const token = url.searchParams.get('token');
	const authorId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(authorId)) {
		return json({ error: 'Invalid author ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		// Check author exists
		const [existingAuthor] = await db.select({ id: authors.id }).from(authors).where(eq(authors.id, authorId)).limit(1);
		if (!existingAuthor) {
			return json({ error: 'Author not found' }, { status: 404 });
		}

		const updateData: Record<string, unknown> = {};
		if (body.name !== undefined) updateData.name = body.name;
		if (body.bio !== undefined) updateData.bio = body.bio;
		if (body.birthDate !== undefined) updateData.birthDate = body.birthDate;
		if (body.deathDate !== undefined) updateData.deathDate = body.deathDate;
		if (body.birthPlace !== undefined) updateData.birthPlace = body.birthPlace;
		if (body.photoUrl !== undefined) updateData.photoUrl = body.photoUrl;
		if (body.website !== undefined) updateData.website = body.website;
		if (body.wikipediaUrl !== undefined) updateData.wikipediaUrl = body.wikipediaUrl;
		if (body.comments !== undefined) updateData.comments = body.comments;

		const updatedAuthor = await updateAuthor(authorId, updateData);

		if (!updatedAuthor) {
			return json({ error: 'Failed to update author' }, { status: 500 });
		}

		return json({
			author: { id: updatedAuthor.id, name: updatedAuthor.name },
			message: 'Author updated successfully'
		});
	} catch (err) {
		console.error('API v1 update author error:', err);
		return json({ error: 'Failed to update author' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/authors/[id] - Delete an author
 */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	const authorId = parseInt(params.id, 10);

	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	if (isNaN(authorId)) {
		return json({ error: 'Invalid author ID' }, { status: 400 });
	}

	try {
		// Check author exists
		const [existingAuthor] = await db.select({ id: authors.id, name: authors.name }).from(authors).where(eq(authors.id, authorId)).limit(1);
		if (!existingAuthor) {
			return json({ error: 'Author not found' }, { status: 404 });
		}

		const deleted = await deleteAuthor(authorId);

		if (!deleted) {
			return json({ error: 'Failed to delete author' }, { status: 500 });
		}

		return json({
			message: `Author "${existingAuthor.name}" deleted successfully`
		});
	} catch (err) {
		console.error('API v1 delete author error:', err);
		return json({ error: 'Failed to delete author' }, { status: 500 });
	}
};
