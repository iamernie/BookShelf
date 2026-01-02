import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books, bookAuthors, bookSeries, bookTags } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';

/**
 * Get book IDs associated with specific catalog entities
 * Used for bulk operations from the catalog manager
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
				// Get books by status ID (direct FK)
				const results = await db
					.select({ id: books.id })
					.from(books)
					.where(inArray(books.statusId, entityIds));
				bookIds = results.map(r => r.id);
				break;
			}

			default:
				throw error(400, `Unknown entity type: ${entityType}`);
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
