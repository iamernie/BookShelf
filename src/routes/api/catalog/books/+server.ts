import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books, bookAuthors, bookSeries, bookTags, userBooks } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import { reachableBookCond } from '$lib/server/services/libraryShareService';

/**
 * Get book IDs associated with specific catalog entities
 * Used for bulk operations from the catalog manager; only books the caller can see are returned
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { entityType, entityIds } = body;

	if (!entityType || !Array.isArray(entityIds) || entityIds.length === 0) {
		throw error(400, 'entityType and entityIds are required');
	}

	let bookIds: number[] = [];

	try {
		switch (entityType) {
			case 'authors': {
				// Get books by author IDs through junction table
				const results = await db
					.select({ bookId: bookAuthors.bookId })
					.from(bookAuthors)
					.where(inArray(bookAuthors.authorId, entityIds));
				bookIds = [...new Set(results.map(r => r.bookId))];
				break;
			}

			case 'series': {
				// Get books by series IDs through junction table
				const results = await db
					.select({ bookId: bookSeries.bookId })
					.from(bookSeries)
					.where(inArray(bookSeries.seriesId, entityIds));
				bookIds = [...new Set(results.map(r => r.bookId))];
				break;
			}

			case 'genres': {
				// Get books by genre ID (direct FK)
				const results = await db
					.select({ id: books.id })
					.from(books)
					.where(inArray(books.genreId, entityIds));
				bookIds = results.map(r => r.id);
				break;
			}

			case 'tags': {
				// Get books by tag IDs through junction table
				const results = await db
					.select({ bookId: bookTags.bookId })
					.from(bookTags)
					.where(inArray(bookTags.tagId, entityIds));
				bookIds = [...new Set(results.map(r => r.bookId))];
				break;
			}

			case 'narrators': {
				// Get books by narrator ID (direct FK)
				const results = await db
					.select({ id: books.id })
					.from(books)
					.where(inArray(books.narratorId, entityIds));
				bookIds = results.map(r => r.id);
				break;
			}

			case 'formats': {
				// Get books by format ID (direct FK)
				const results = await db
					.select({ id: books.id })
					.from(books)
					.where(inArray(books.formatId, entityIds));
				bookIds = results.map(r => r.id);
				break;
			}

			case 'statuses': {
				// Status is the caller's own: books with that status in their user_books
				const results = await db
					.select({ id: userBooks.bookId })
					.from(userBooks)
					.where(and(eq(userBooks.userId, locals.user.id), inArray(userBooks.statusId, entityIds)));
				bookIds = [...new Set(results.map(r => r.id))];
				break;
			}

			default:
				throw error(400, `Unknown entity type: ${entityType}`);
		}

		// Never hand out the ids of books the caller can't see
		if (bookIds.length > 0) {
			const visible = await db
				.select({ id: books.id })
				.from(books)
				.where(and(inArray(books.id, bookIds), reachableBookCond(locals.user)));
			const visibleIds = new Set(visible.map(r => r.id));
			bookIds = bookIds.filter(id => visibleIds.has(id));
		}

		return json({
			bookIds,
			count: bookIds.length
		});
	} catch (err) {
		if (err instanceof Response) throw err;
		console.error('Error getting books for entities:', err);
		throw error(500, 'Failed to get books');
	}
};
