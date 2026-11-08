import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, books, bookAuthors, bookSeries, bookTags, userBooks, userBookTags, metadataSuggestions, readingSessions, bookdropQueue } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import { recomputeSeriesStatuses } from '$lib/server/services/statusService';
import { deleteDecision, partitionBooks } from '$lib/server/services/libraryShareService';
import { removeBookFromUserLibrary } from '$lib/server/services/userBookService';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { bookIds } = body;

	if (!Array.isArray(bookIds) || bookIds.length === 0) {
		throw error(400, 'bookIds must be a non-empty array');
	}

	// Per book, as the single DELETE decides: public books are deleted by the catalog managers and
	// removed from the caller's own library for anyone else holding them; a personal book needs
	// ownership or a full share. Everything else, another member's personal book included whatever
	// the caller's role, is skipped and reported, its files left on disk
	const user = locals.user;
	const decisions = new Map<number, 'delete' | 'remove' | 'deny'>();
	const { allowed, skipped } = await partitionBooks(bookIds, async (book) => {
		const d = await deleteDecision(user, book);
		decisions.set(book.id, d);
		return d !== 'deny';
	});
	const removed = allowed.filter((id) => decisions.get(id) === 'remove');
	const toDelete = allowed.filter((id) => decisions.get(id) === 'delete');

	for (const id of removed) await removeBookFromUserLibrary(user.id, id);

	const removedNote = removed.length > 0 ? `; ${removed.length} public book(s) removed from your library` : '';
	const skippedNote = skipped.length > 0 ? `; ${skipped.length} skipped (no permission or not found)` : '';
	const report = {
		success: true,
		deleted: toDelete.length,
		removed,
		skipped,
		message: `Deleted ${toDelete.length} book(s)${removedNote}${skippedNote}`
	};
	if (toDelete.length === 0) return json(report);

	// Fetch books to get file paths for cleanup
	const booksToDelete = await db
		.select({
			id: books.id,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath
		})
		.from(books)
		.where(inArray(books.id, toDelete));

	// Delete associated files
	const coversPath = process.env.COVERS_PATH || './static/covers';
	const ebooksPath = process.env.EBOOKS_PATH || './static/ebooks';

	for (const book of booksToDelete) {
		// Delete cover image if it's a local file
		if (book.coverImageUrl && book.coverImageUrl.startsWith('/covers/')) {
			const coverFile = path.join(coversPath, path.basename(book.coverImageUrl));
			try {
				if (existsSync(coverFile)) {
					await unlink(coverFile);
				}
			} catch (e) {
				console.error(`Failed to delete cover file: ${coverFile}`, e);
			}
		}

		// Delete ebook file
		if (book.ebookPath) {
			const ebookFile = path.join(ebooksPath, path.basename(book.ebookPath));
			try {
				if (existsSync(ebookFile)) {
					await unlink(ebookFile);
				}
			} catch (e) {
				console.error(`Failed to delete ebook file: ${ebookFile}`, e);
			}
		}
	}

	const memberOf = await db.select({ seriesId: bookSeries.seriesId }).from(bookSeries).where(inArray(bookSeries.bookId, toDelete));

	// Delete related records (should cascade, but being explicit)
	await db.delete(bookAuthors).where(inArray(bookAuthors.bookId, toDelete));
	await db.delete(bookSeries).where(inArray(bookSeries.bookId, toDelete));
	await db.delete(bookTags).where(inArray(bookTags.bookId, toDelete));
	await db.delete(userBooks).where(inArray(userBooks.bookId, toDelete));
	await db.delete(userBookTags).where(inArray(userBookTags.bookId, toDelete));
	await db.delete(metadataSuggestions).where(inArray(metadataSuggestions.bookId, toDelete));
	await db.delete(readingSessions).where(inArray(readingSessions.bookId, toDelete));
	await db.delete(bookdropQueue).where(inArray(bookdropQueue.bookId, toDelete));

	// Delete books
	const result = await db.delete(books).where(inArray(books.id, toDelete));
	await recomputeSeriesStatuses(memberOf.map((r) => r.seriesId));

	return json(report);
};
