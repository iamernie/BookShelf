/**
 * Admin API to verify the KOReader hashes of all ebooks
 *
 * POST /api/admin/rehash-ebooks - Hash every ebook file, record the hash, and move books.ebookMd5
 *
 * Nothing is deleted, so a device holding an older copy of a file keeps matching. A missing
 * file is reported and its stored hashes stay as they are. Files replaced on disk have no app
 * event, so this is also how those hashes get picked up.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { and, isNull, isNotNull } from 'drizzle-orm';
import { computeFileKoreaderMd5, getEbookPath } from '$lib/server/services/ebookService';
import { setCurrentEbookHash } from '$lib/server/services/ebookHashService';

export const POST: RequestHandler = async ({ locals }) => {
	// Admin only
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const booksToProcess = await db
		.select({
			id: books.id,
			title: books.title,
			ebookPath: books.ebookPath
		})
		.from(books)
		.where(isNotNull(books.ebookPath));

	const results = {
		total: booksToProcess.length,
		updated: 0, // books.ebookMd5 moved
		added: 0, // a hash was new to this book
		unchanged: 0,
		missing: [] as { id: number; title: string }[],
		errors: [] as { id: number; title: string; error: string }[]
	};

	for (const book of booksToProcess) {
		if (!book.ebookPath) continue;

		try {
			const filepath = getEbookPath(book.ebookPath);
			if (!filepath) {
				results.missing.push({ id: book.id, title: book.title });
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

			const { added, mirrorChanged } = await setCurrentEbookHash(book.id, md5, 'rehash');
			if (added) results.added++;
			if (mirrorChanged) results.updated++;
			if (!added && !mirrorChanged) results.unchanged++;
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
