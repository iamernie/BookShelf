import { json, error, isHttpError } from '@sveltejs/kit';
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
import { isAdmin } from '$lib/server/services/permissionService';
import { repointAndConcatEntityNotes } from '$lib/server/services/entityNotesService';

// Merges rewrite the shared catalog for every user: admin-only, as the author and narrator merges.
// Everything runs in one transaction, and every user's notes on a merged-away author, series or
// narrator join theirs on the primary before the delete would cascade them away
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isAdmin(locals.user)) {
		throw error(403, { message: 'Only admins can merge catalog entries' });
	}

	const body = await request.json();
	const { entityType, primaryId } = body;

	// The primary never merges into itself (that would delete it)
	const mergeIds: number[] = Array.isArray(body.mergeIds)
		? [...new Set<number>(body.mergeIds.filter((id: unknown): id is number => Number.isInteger(id) && id !== primaryId))]
		: [];

	if (!entityType || !Number.isInteger(primaryId) || mergeIds.length === 0) {
		throw error(400, 'Invalid merge request');
	}

	log.info('Merging entities', { entityType, primaryId, mergeIds });

	try {
		const primaryName = db.transaction((tx) => {
			const now = new Date().toISOString();

			switch (entityType) {
				case 'authors': {
					const primary = tx.select().from(authors).where(eq(authors.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary author not found');

					// Update books.authorId to primary
					tx.update(books).set({ authorId: primaryId }).where(inArray(books.authorId, mergeIds)).run();

					// Link the merged authors' books to the primary where they aren't already
					const existingBookIds = new Set(
						tx.select({ bookId: bookAuthors.bookId }).from(bookAuthors).where(eq(bookAuthors.authorId, primaryId)).all().map((b) => b.bookId)
					);
					const mergeAuthorBooks = tx.select({ bookId: bookAuthors.bookId }).from(bookAuthors).where(inArray(bookAuthors.authorId, mergeIds)).all();
					for (const { bookId } of mergeAuthorBooks) {
						if (bookId && !existingBookIds.has(bookId)) {
							tx.insert(bookAuthors).values({ bookId, authorId: primaryId, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
							existingBookIds.add(bookId);
						}
					}

					// Delete old junction entries
					tx.delete(bookAuthors).where(inArray(bookAuthors.authorId, mergeIds)).run();

					// Every user's own notes on each merged author join theirs on the primary
					for (const id of mergeIds) repointAndConcatEntityNotes(tx, 'author', id, primaryId);

					// Delete merged authors
					tx.delete(authors).where(inArray(authors.id, mergeIds)).run();
					return primary.name;
				}

				case 'series': {
					const primary = tx.select().from(series).where(eq(series.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary series not found');

					// Update books.seriesId to primary
					tx.update(books).set({ seriesId: primaryId }).where(inArray(books.seriesId, mergeIds)).run();

					// Link the merged series' books to the primary, keeping their numbers
					const existingBookIds = new Set(
						tx.select({ bookId: bookSeries.bookId }).from(bookSeries).where(eq(bookSeries.seriesId, primaryId)).all().map((b) => b.bookId)
					);
					const mergeSeriesBooks = tx
						.select({ bookId: bookSeries.bookId, bookNum: bookSeries.bookNum })
						.from(bookSeries)
						.where(inArray(bookSeries.seriesId, mergeIds))
						.all();
					for (const { bookId, bookNum } of mergeSeriesBooks) {
						if (bookId && !existingBookIds.has(bookId)) {
							tx.insert(bookSeries).values({ bookId, seriesId: primaryId, bookNum, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
							existingBookIds.add(bookId);
						}
					}

					// Merge series tags
					const existingTagIds = new Set(
						tx.select({ tagId: seriesTags.tagId }).from(seriesTags).where(eq(seriesTags.seriesId, primaryId)).all().map((t) => t.tagId)
					);
					const mergeSeriesTags = tx.select({ tagId: seriesTags.tagId }).from(seriesTags).where(inArray(seriesTags.seriesId, mergeIds)).all();
					for (const { tagId } of mergeSeriesTags) {
						if (tagId && !existingTagIds.has(tagId)) {
							tx.insert(seriesTags).values({ seriesId: primaryId, tagId, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
							existingTagIds.add(tagId);
						}
					}

					// Delete old junction entries
					tx.delete(bookSeries).where(inArray(bookSeries.seriesId, mergeIds)).run();
					tx.delete(seriesTags).where(inArray(seriesTags.seriesId, mergeIds)).run();

					// Every user's own notes on each merged series join theirs on the primary
					for (const id of mergeIds) repointAndConcatEntityNotes(tx, 'series', id, primaryId);

					// Delete merged series
					tx.delete(series).where(inArray(series.id, mergeIds)).run();
					return primary.title;
				}

				case 'genres': {
					const primary = tx.select().from(genres).where(eq(genres.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary genre not found');

					tx.update(books).set({ genreId: primaryId }).where(inArray(books.genreId, mergeIds)).run();
					tx.delete(genres).where(inArray(genres.id, mergeIds)).run();
					return primary.name;
				}

				case 'tags': {
					const primary = tx.select().from(tags).where(eq(tags.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary tag not found');

					// Move book tags to the primary
					const existingBookIds = new Set(
						tx.select({ bookId: bookTags.bookId }).from(bookTags).where(eq(bookTags.tagId, primaryId)).all().map((b) => b.bookId)
					);
					const mergeTagBooks = tx.select({ bookId: bookTags.bookId }).from(bookTags).where(inArray(bookTags.tagId, mergeIds)).all();
					for (const { bookId } of mergeTagBooks) {
						if (bookId && !existingBookIds.has(bookId)) {
							tx.insert(bookTags).values({ bookId, tagId: primaryId, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
							existingBookIds.add(bookId);
						}
					}

					// Move series tags to the primary
					const existingSeriesIds = new Set(
						tx.select({ seriesId: seriesTags.seriesId }).from(seriesTags).where(eq(seriesTags.tagId, primaryId)).all().map((s) => s.seriesId)
					);
					const mergeTagSeries = tx.select({ seriesId: seriesTags.seriesId }).from(seriesTags).where(inArray(seriesTags.tagId, mergeIds)).all();
					for (const { seriesId } of mergeTagSeries) {
						if (seriesId && !existingSeriesIds.has(seriesId)) {
							tx.insert(seriesTags).values({ seriesId, tagId: primaryId, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
							existingSeriesIds.add(seriesId);
						}
					}

					// Delete old junction entries
					tx.delete(bookTags).where(inArray(bookTags.tagId, mergeIds)).run();
					tx.delete(seriesTags).where(inArray(seriesTags.tagId, mergeIds)).run();

					// Delete merged tags
					tx.delete(tags).where(inArray(tags.id, mergeIds)).run();
					return primary.name;
				}

				case 'narrators': {
					const primary = tx.select().from(narrators).where(eq(narrators.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary narrator not found');

					tx.update(books).set({ narratorId: primaryId }).where(inArray(books.narratorId, mergeIds)).run();

					// Every user's own notes on each merged narrator join theirs on the primary
					for (const id of mergeIds) repointAndConcatEntityNotes(tx, 'narrator', id, primaryId);

					tx.delete(narrators).where(inArray(narrators.id, mergeIds)).run();
					return primary.name;
				}

				case 'formats': {
					const primary = tx.select().from(formats).where(eq(formats.id, primaryId)).get();
					if (!primary) throw error(404, 'Primary format not found');

					tx.update(books).set({ formatId: primaryId }).where(inArray(books.formatId, mergeIds)).run();
					tx.delete(formats).where(inArray(formats.id, mergeIds)).run();
					return primary.name;
				}

				default:
					throw error(400, `Unsupported entity type: ${entityType}`);
			}
		});

		log.info('Merge completed', { entityType, primaryId, mergedCount: mergeIds.length, name: primaryName });

		return json({ success: true, name: primaryName });
	} catch (err) {
		// A missing primary or an unknown type keeps its status; the transaction has rolled back
		if (isHttpError(err)) throw err;
		const message = err instanceof Error ? err.message : String(err);
		log.error('Merge failed', { error: message, entityType, primaryId, mergeIds });
		throw error(500, message || 'Failed to merge entities');
	}
};
