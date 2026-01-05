/**
 * Admin API to compute KOReader-compatible MD5 hashes for existing ebooks
 *
 * POST /api/admin/rehash-ebooks - Compute MD5 hashes for all ebooks without one
 * POST /api/admin/rehash-ebooks?force=true - Regenerate ALL ebook hashes (use after algorithm change)
 *
 * This is needed for KOReader sync to work with books uploaded before the feature was added,
 * or when the hashing algorithm changes (e.g., switching from full-file to partial MD5)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { computeFileKoreaderMd5, getEbookPath } from '$lib/server/services/ebookService';

export const POST: RequestHandler = async ({ locals, url }) => {
	// Admin only
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	// Check if force regeneration is requested (regenerate ALL hashes)
	const force = url.searchParams.get('force') === 'true';

	// Find books to process
	// - If force=true: all books with ebooks (regenerate all)
	// - Otherwise: only books with ebooks but no MD5 hash
	const booksToProcess = await db
		.select({
			id: books.id,
			title: books.title,
			ebookPath: books.ebookPath
		})
		.from(books)
		.where(
			force
				? isNotNull(books.ebookPath)
				: and(
						isNotNull(books.ebookPath),
						isNull(books.ebookMd5)
					)
		);

	const results = {
		total: booksToProcess.length,
		updated: 0,
		force,
		errors: [] as { id: number; title: string; error: string }[]
	};

	for (const book of booksToProcess) {
		if (!book.ebookPath) continue;

		try {
			const filepath = getEbookPath(book.ebookPath);
			if (!filepath) {
				results.errors.push({
					id: book.id,
					title: book.title,
					error: 'Could not resolve ebook path'
				});
				continue;
			}

			// Use KOReader-compatible partial MD5 hash
			const md5 = await computeFileKoreaderMd5(filepath);
			if (!md5) {
				results.errors.push({
					id: book.id,
					title: book.title,
					error: 'Could not compute MD5 hash'
				});
				continue;
			}

			await db
				.update(books)
				.set({
					ebookMd5: md5,
					updatedAt: new Date().toISOString()
				})
				.where(eq(books.id, book.id));

			results.updated++;
		} catch (e) {
			results.errors.push({
				id: book.id,
				title: book.title,
				error: e instanceof Error ? e.message : 'Unknown error'
			});
		}
	}

	return json(results);
};

// GET to check status without making changes
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const [stats] = await db
		.select({
			total: db.$count(books),
			withEbook: db.$count(books, isNotNull(books.ebookPath)),
			withHash: db.$count(books, and(isNotNull(books.ebookPath), isNotNull(books.ebookMd5))),
			needsHash: db.$count(books, and(isNotNull(books.ebookPath), isNull(books.ebookMd5)))
		})
		.from(books);

	return json(stats);
};
