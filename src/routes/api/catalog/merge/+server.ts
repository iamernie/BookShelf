import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	books,
	bookAuthors,
	bookSeries,
	bookTags,
	seriesTags,
	authors,
	series,
	genres,
	tags,
	narrators,
	formats
} from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { log } from '$lib/server/services/loggerService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const { entityType, primaryId, mergeIds } = await request.json();

	if (!entityType || !primaryId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
		throw error(400, 'Invalid merge request');
	}

	log.info('Merging entities', { entityType, primaryId, mergeIds });

	try {
		let primaryName = '';

		switch (entityType) {
			case 'authors': {
				// Get primary author name
				const [primary] = await db.select().from(authors).where(eq(authors.id, primaryId));
				if (!primary) throw error(404, 'Primary author not found');
				primaryName = primary.name;

				// Update books.authorId to primary
				await db
					.update(books)
					.set({ authorId: primaryId })
					.where(inArray(books.authorId, mergeIds));

				// Update bookAuthors junction table
				// First get existing entries for primary
				const existingPrimaryBooks = await db
					.select({ bookId: bookAuthors.bookId })
					.from(bookAuthors)
					.where(eq(bookAuthors.authorId, primaryId));
				const existingBookIds = new Set(existingPrimaryBooks.map(b => b.bookId));

				// Get books from merge authors that aren't already linked to primary
				const mergeAuthorBooks = await db
					.select({ bookId: bookAuthors.bookId })
					.from(bookAuthors)
					.where(inArray(bookAuthors.authorId, mergeIds));

				// Add new links
				const now = new Date().toISOString();
				for (const { bookId } of mergeAuthorBooks) {
					if (bookId && !existingBookIds.has(bookId)) {
						await db.insert(bookAuthors).values({
							bookId,
							authorId: primaryId,
							createdAt: now,
							updatedAt: now
						}).onConflictDoNothing();
					}
				}

				// Delete old junction entries
				await db.delete(bookAuthors).where(inArray(bookAuthors.authorId, mergeIds));

				// Delete merged authors
				await db.delete(authors).where(inArray(authors.id, mergeIds));
				break;
			}

			case 'series': {
				// Get primary series name
				const [primary] = await db.select().from(series).where(eq(series.id, primaryId));
				if (!primary) throw error(404, 'Primary series not found');
				primaryName = primary.title;

				// Update books.seriesId to primary
				await db
					.update(books)
					.set({ seriesId: primaryId })
					.where(inArray(books.seriesId, mergeIds));

				// Update bookSeries junction table
				const existingPrimaryBooks = await db
					.select({ bookId: bookSeries.bookId })
					.from(bookSeries)
					.where(eq(bookSeries.seriesId, primaryId));
				const existingBookIds = new Set(existingPrimaryBooks.map(b => b.bookId));

				const mergeSeriesBooks = await db
					.select({ bookId: bookSeries.bookId, bookNum: bookSeries.bookNum })
					.from(bookSeries)
					.where(inArray(bookSeries.seriesId, mergeIds));

				const now = new Date().toISOString();
				for (const { bookId, bookNum } of mergeSeriesBooks) {
					if (bookId && !existingBookIds.has(bookId)) {
						await db.insert(bookSeries).values({
							bookId,
							seriesId: primaryId,
							bookNum,
							createdAt: now,
							updatedAt: now
						}).onConflictDoNothing();
					}
				}

				// Merge series tags
				const existingPrimaryTags = await db
					.select({ tagId: seriesTags.tagId })
					.from(seriesTags)
					.where(eq(seriesTags.seriesId, primaryId));
				const existingTagIds = new Set(existingPrimaryTags.map(t => t.tagId));

				const mergeSeriesTags = await db
					.select({ tagId: seriesTags.tagId })
					.from(seriesTags)
					.where(inArray(seriesTags.seriesId, mergeIds));

				for (const { tagId } of mergeSeriesTags) {
					if (tagId && !existingTagIds.has(tagId)) {
						await db.insert(seriesTags).values({
							seriesId: primaryId,
							tagId,
							createdAt: now,
							updatedAt: now
						}).onConflictDoNothing();
					}
				}

				// Delete old junction entries
				await db.delete(bookSeries).where(inArray(bookSeries.seriesId, mergeIds));
				await db.delete(seriesTags).where(inArray(seriesTags.seriesId, mergeIds));

				// Delete merged series
				await db.delete(series).where(inArray(series.id, mergeIds));
				break;
			}

			case 'genres': {
				// Get primary genre name
				const [primary] = await db.select().from(genres).where(eq(genres.id, primaryId));
				if (!primary) throw error(404, 'Primary genre not found');
				primaryName = primary.name;

				// Update books.genreId to primary
				await db
					.update(books)
					.set({ genreId: primaryId })
					.where(inArray(books.genreId, mergeIds));

				// Delete merged genres
				await db.delete(genres).where(inArray(genres.id, mergeIds));
				break;
			}

			case 'tags': {
				// Get primary tag name
				const [primary] = await db.select().from(tags).where(eq(tags.id, primaryId));
				if (!primary) throw error(404, 'Primary tag not found');
				primaryName = primary.name;

				// Update bookTags junction table
				const existingPrimaryBooks = await db
					.select({ bookId: bookTags.bookId })
					.from(bookTags)
					.where(eq(bookTags.tagId, primaryId));
				const existingBookIds = new Set(existingPrimaryBooks.map(b => b.bookId));

				const mergeTagBooks = await db
					.select({ bookId: bookTags.bookId })
					.from(bookTags)
					.where(inArray(bookTags.tagId, mergeIds));

				const now = new Date().toISOString();
				for (const { bookId } of mergeTagBooks) {
					if (bookId && !existingBookIds.has(bookId)) {
						await db.insert(bookTags).values({
							bookId,
							tagId: primaryId,
							createdAt: now,
							updatedAt: now
						}).onConflictDoNothing();
					}
				}

				// Update seriesTags junction table
				const existingPrimarySeries = await db
					.select({ seriesId: seriesTags.seriesId })
					.from(seriesTags)
					.where(eq(seriesTags.tagId, primaryId));
				const existingSeriesIds = new Set(existingPrimarySeries.map(s => s.seriesId));

				const mergeTagSeries = await db
					.select({ seriesId: seriesTags.seriesId })
					.from(seriesTags)
					.where(inArray(seriesTags.tagId, mergeIds));

				for (const { seriesId } of mergeTagSeries) {
					if (seriesId && !existingSeriesIds.has(seriesId)) {
						await db.insert(seriesTags).values({
							seriesId,
							tagId: primaryId,
							createdAt: now,
							updatedAt: now
						}).onConflictDoNothing();
					}
				}

				// Delete old junction entries
				await db.delete(bookTags).where(inArray(bookTags.tagId, mergeIds));
				await db.delete(seriesTags).where(inArray(seriesTags.tagId, mergeIds));

				// Delete merged tags
				await db.delete(tags).where(inArray(tags.id, mergeIds));
				break;
			}

			case 'narrators': {
				// Get primary narrator name
				const [primary] = await db.select().from(narrators).where(eq(narrators.id, primaryId));
				if (!primary) throw error(404, 'Primary narrator not found');
				primaryName = primary.name;

				// Update books.narratorId to primary
				await db
					.update(books)
					.set({ narratorId: primaryId })
					.where(inArray(books.narratorId, mergeIds));

				// Delete merged narrators
				await db.delete(narrators).where(inArray(narrators.id, mergeIds));
				break;
			}

			case 'formats': {
				// Get primary format name
				const [primary] = await db.select().from(formats).where(eq(formats.id, primaryId));
				if (!primary) throw error(404, 'Primary format not found');
				primaryName = primary.name;

				// Update books.formatId to primary
				await db
					.update(books)
					.set({ formatId: primaryId })
					.where(inArray(books.formatId, mergeIds));

				// Delete merged formats
				await db.delete(formats).where(inArray(formats.id, mergeIds));
				break;
			}

			default:
				throw error(400, `Unsupported entity type: ${entityType}`);
		}

		log.info('Merge completed', { entityType, primaryId, mergedCount: mergeIds.length, name: primaryName });

		return json({ success: true, name: primaryName });
	} catch (err: any) {
		log.error('Merge failed', { error: err.message, entityType, primaryId, mergeIds });
		throw error(500, err.message || 'Failed to merge entities');
	}
};
