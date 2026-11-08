import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, authors, series, bookAuthors, bookSeries } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ebookExists, parseReadingProgress } from '$lib/server/services/ebookService';
import { canReadEbook, canReachBook } from '$lib/server/services/libraryShareService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { getOwnPosition } from '$lib/server/services/personalState';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const bookId = parseInt(params.id);

	if (isNaN(bookId)) {
		throw error(400, 'Invalid book ID');
	}

	// Get book with relations
	const [book] = await db
		.select()
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw error(404, 'Book not found');
	}

	if (!(await canReadEbook(locals.user, bookId))) {
		// Reading needs the book in the user's library: a reachable book goes back to its page,
		// which asks to Add it first (2.30.0); the reader never adds it on its own
		if (hasPermission(locals.user, Permission.READ_EBOOKS) && (await canReachBook(locals.user.id, bookId))) {
			redirect(303, `/books/${bookId}?read=1`);
		}
		throw error(403, { message: 'You do not have access to this book' });
	}

	if (!book.ebookPath) {
		redirect(302, `/books/${bookId}`);
	}

	if (!ebookExists(book.ebookPath)) {
		throw error(404, 'Ebook file not found. It may have been deleted.');
	}

	// Get authors
	const bookAuthorRows = await db
		.select({
			id: authors.id,
			name: authors.name,
			role: bookAuthors.role,
			isPrimary: bookAuthors.isPrimary
		})
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, bookId))
		.orderBy(bookAuthors.displayOrder);

	// Get series
	const bookSeriesRows = await db
		.select({
			id: series.id,
			title: series.title,
			bookNum: bookSeries.bookNum,
			isPrimary: bookSeries.isPrimary
		})
		.from(bookSeries)
		.innerJoin(series, eq(bookSeries.seriesId, series.id))
		.where(eq(bookSeries.bookId, bookId))
		.orderBy(bookSeries.displayOrder);

	// The reader's own saved position
	const progress = parseReadingProgress((await getOwnPosition(locals.user.id, bookId)).position);

	// Construct ebook URL - handle both simple filenames and full paths
	let ebookUrl = book.ebookPath;
	if (ebookUrl && !ebookUrl.startsWith('/')) {
		ebookUrl = `/ebooks/${ebookUrl}`;
	}

	return {
		book: {
			id: book.id,
			title: book.title,
			coverImageUrl: book.coverImageUrl,
			ebookPath: book.ebookPath,
			ebookFormat: book.ebookFormat
		},
		authors: bookAuthorRows,
		series: bookSeriesRows,
		progress,
		// epub.js needs direct access to the file, so serve from static folder
		ebookUrl
	};
};
