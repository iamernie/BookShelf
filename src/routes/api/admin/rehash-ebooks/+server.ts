/**
 * Admin API to compute MD5 hashes for existing ebooks
 *
 * POST /api/admin/rehash-ebooks - Compute MD5 hashes for all ebooks without one
 *
 * This is needed for KOReader sync to work with books uploaded before the feature was added
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { computeFileMd5, getEbookPath } from '$lib/server/services/ebookService';

export const POST: RequestHandler = async ({ locals }) => {
	// Admin only
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	// Find all books with ebooks but no MD5 hash
	const booksWithoutHash = await db
		.select({
			id: books.id,
			title: books.title,
			ebookPath: books.ebookPath
		})
		.from(books)
		.where(
			and(
				isNotNull(books.ebookPath),
				isNull(books.ebookMd5)
			)
		);

	const results = {
		total: booksWithoutHash.length,
		updated: 0,
		errors: [] as { id: number; title: string; error: string }[]
	};

	for (const book of booksWithoutHash) {
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

			const md5 = await computeFileMd5(filepath);
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
