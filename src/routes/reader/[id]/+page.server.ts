import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, authors, series, bookAuthors, bookSeries } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ebookExists, parseReadingProgress } from '$lib/server/services/ebookService';

export const load: PageServerLoad = async ({ params }) => {
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

	// Parse saved progress
	const progress = parseReadingProgress(book.readingProgress);

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
