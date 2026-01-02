/**
 * CSV Import API
 * POST - Upload and preview CSV file
 * PUT - Execute import for selected rows
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	parseCSV,
	isGoodreadsFormat,
	mapGoodreadsRow,
	mapStandardRow,
	parseSeriesFromTitle,
	findDuplicate,
	fuzzyMatchAuthor,
	normalizeString,
	type ParsedBook
} from '$lib/server/services/importService';
import { db, books, authors, series, narrators, statuses, formats, genres } from '$lib/server/db';
import { eq, asc, like } from 'drizzle-orm';
import { createBook } from '$lib/server/services/bookService';

// Temporary storage for parsed import data (in production, use session or redis)
const importSessions = new Map<string, { parsedBooks: ParsedBook[]; timestamp: number }>();

// Clean up old sessions (older than 1 hour)
function cleanupSessions() {
	const oneHourAgo = Date.now() - 60 * 60 * 1000;
	for (const [id, session] of importSessions) {
		if (session.timestamp < oneHourAgo) {
			importSessions.delete(id);
		}
	}
}

/**
 * POST - Parse and preview CSV
 */
export const POST: RequestHandler = async ({ request }) => {
	cleanupSessions();

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	const content = await file.text();
	const { headers, rows } = parseCSV(content);

	if (rows.length === 0) {
		throw error(400, 'CSV file is empty or has no data rows');
	}

	// Detect format
	const isGoodreads = isGoodreadsFormat(headers);

	// Get existing data for matching
	const [existingAuthors, existingSeries, existingBooks, existingStatuses, existingFormats, existingGenres] = await Promise.all([
		db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
		db.select({ id: series.id, title: series.title }).from(series).orderBy(asc(series.title)),
		db.select({
			id: books.id,
			title: books.title,
			author: authors.name,
			isbn10: books.isbn10,
			isbn13: books.isbn13,
			goodreadsId: books.goodreadsId
		}).from(books)
			.leftJoin(authors, eq(books.authorId, authors.id)),
		db.select().from(statuses).orderBy(asc(statuses.sortOrder)),
		db.select().from(formats).orderBy(asc(formats.name)),
		db.select().from(genres).orderBy(asc(genres.name))
	]);

	// Map existing books for duplicate checking (handle null authors)
	const existingBooksForDupeCheck = existingBooks.map(b => ({
		id: b.id,
		title: b.title,
		author: b.author || '',
		isbn10: b.isbn10,
		isbn13: b.isbn13,
		goodreadsId: b.goodreadsId
	}));

	// Process each row
	const parsedBooks: ParsedBook[] = rows.map((row, index) => {
		const mapped = isGoodreads ? mapGoodreadsRow(row) : mapStandardRow(row);

		// Parse series from title if needed
		let cleanTitle = mapped.title;
		let seriesName = mapped.series || null;
		let bookNum = mapped.bookNum ? parseFloat(mapped.bookNum) : null;

		if (!seriesName && mapped.title) {
			const parsed = parseSeriesFromTitle(mapped.title);
			cleanTitle = parsed.cleanTitle;
			seriesName = parsed.series;
			bookNum = parsed.bookNum;
		}

		// Match author
		let authorMatch = null;
		let authorId = null;
		if (mapped.author) {
			const match = fuzzyMatchAuthor(mapped.author, existingAuthors);
			if (match) {
				authorMatch = { id: match.author.id, name: match.author.name, confidence: match.confidence, exact: match.exact };
				authorId = match.author.id;
			}
		}

		// Match series
		let seriesMatch = null;
		let seriesId = null;
		if (seriesName) {
			const normalizedSeriesName = normalizeString(seriesName);
			const match = existingSeries.find(s =>
				normalizeString(s.title) === normalizedSeriesName
			);
			if (match) {
				seriesMatch = { id: match.id, title: match.title, exact: true };
				seriesId = match.id;
			}
		}

		// Match status
		let statusId = null;
		if (mapped.status) {
			const normalizedStatus = normalizeString(mapped.status);
			const match = existingStatuses.find(s =>
				normalizeString(s.name) === normalizedStatus ||
				s.key?.toLowerCase() === normalizedStatus
			);
			if (match) {
				statusId = match.id;
			}
		}

		// Match format
		let formatId = null;
		if (mapped.format) {
			const normalizedFormat = normalizeString(mapped.format);
			const match = existingFormats.find(f =>
				normalizeString(f.name) === normalizedFormat
			);
			if (match) {
				formatId = match.id;
			}
		}

		// Match genre
		let genreId = null;
		if (mapped.genre) {
			const normalizedGenre = normalizeString(mapped.genre);
			const match = existingGenres.find(g =>
				normalizeString(g.name) === normalizedGenre
			);
			if (match) {
				genreId = match.id;
			}
		}

		// Check for duplicate
		const duplicate = findDuplicate(
			{
				title: cleanTitle,
				author: mapped.author,
				isbn: mapped.isbn,
				isbn13: mapped.isbn13,
				goodreadsId: mapped.goodreadsId
			},
			existingBooksForDupeCheck
		);

		return {
			rowIndex: index,
			originalTitle: mapped.title,
			title: cleanTitle,
			author: mapped.author,
			authorId,
			authorMatch,
			series: seriesName,
			seriesId,
			seriesMatch,
			bookNum,
			narrator: mapped.narrator || '',
			narratorId: null,
			isbn: mapped.isbn,
			isbn13: mapped.isbn13,
			goodreadsId: mapped.goodreadsId,
			formatId,
			format: mapped.format,
			genreId,
			genre: mapped.genre || '',
			statusId,
			status: mapped.status,
			rating: mapped.rating ? parseFloat(mapped.rating) : null,
			startDate: mapped.startDate,
			completedDate: mapped.completedDate,
			releaseDate: mapped.releaseDate || '',
			publishYear: mapped.publishYear ? parseInt(mapped.publishYear) : null,
			pageCount: mapped.pageCount ? parseInt(mapped.pageCount) : null,
			publisher: mapped.publisher,
			summary: mapped.summary || '',
			comments: mapped.comments,
			coverUrl: '',
			isDuplicate: !!duplicate,
			duplicateBookId: duplicate?.id || null
		};
	});

	// Generate session ID and store
	const sessionId = crypto.randomUUID();
	importSessions.set(sessionId, { parsedBooks, timestamp: Date.now() });

	return json({
		sessionId,
		isGoodreads,
		totalRows: parsedBooks.length,
		duplicateCount: parsedBooks.filter(b => b.isDuplicate).length,
		books: parsedBooks,
		options: {
			statuses: existingStatuses,
			formats: existingFormats,
			genres: existingGenres,
			authors: existingAuthors.slice(0, 100), // Limit for initial response
			series: existingSeries.slice(0, 100)
		}
	});
};

/**
 * PUT - Execute import
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const { sessionId, selectedRows, createMissing = true } = await request.json();

	if (!sessionId) {
		throw error(400, 'No session ID provided');
	}

	const session = importSessions.get(sessionId);
	if (!session) {
		throw error(400, 'Import session expired. Please upload the file again.');
	}

	const booksToImport = session.parsedBooks.filter(b =>
		selectedRows.includes(b.rowIndex) && !b.isDuplicate
	);

	if (booksToImport.length === 0) {
		throw error(400, 'No valid books to import');
	}

	const results = {
		imported: 0,
		skipped: 0,
		errors: [] as { row: number; title: string; error: string }[]
	};

	// Get or create authors/series as needed
	const authorCache = new Map<string, number>();
	const seriesCache = new Map<string, number>();
	const narratorCache = new Map<string, number>();

	for (const book of booksToImport) {
		try {
			// Get or create author
			let authorId = book.authorId;
			if (!authorId && book.author && createMissing) {
				const authorKey = book.author.toLowerCase().trim();
				if (authorCache.has(authorKey)) {
					authorId = authorCache.get(authorKey)!;
				} else {
					// Check if author exists
					const existing = await db.select({ id: authors.id })
						.from(authors)
						.where(like(authors.name, book.author))
						.limit(1);

					if (existing.length > 0) {
						authorId = existing[0].id;
					} else {
						// Create new author
						const [newAuthor] = await db.insert(authors).values({
							name: book.author,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
						}).returning();
						authorId = newAuthor.id;
					}
					authorCache.set(authorKey, authorId);
				}
			}

			// Get or create series
			let seriesId = book.seriesId;
			if (!seriesId && book.series && createMissing) {
				const seriesKey = book.series.toLowerCase().trim();
				if (seriesCache.has(seriesKey)) {
					seriesId = seriesCache.get(seriesKey)!;
				} else {
					const existing = await db.select({ id: series.id })
						.from(series)
						.where(like(series.title, book.series))
						.limit(1);

					if (existing.length > 0) {
						seriesId = existing[0].id;
					} else {
						const [newSeries] = await db.insert(series).values({
							title: book.series,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
						}).returning();
						seriesId = newSeries.id;
					}
					seriesCache.set(seriesKey, seriesId);
				}
			}

			// Get or create narrator (for audiobooks)
			let narratorId = book.narratorId;
			if (!narratorId && book.narrator && createMissing) {
				const narratorKey = book.narrator.toLowerCase().trim();
				if (narratorCache.has(narratorKey)) {
					narratorId = narratorCache.get(narratorKey)!;
				} else {
					const existing = await db.select({ id: narrators.id })
						.from(narrators)
						.where(like(narrators.name, book.narrator))
						.limit(1);

					if (existing.length > 0) {
						narratorId = existing[0].id;
					} else {
						const [newNarrator] = await db.insert(narrators).values({
							name: book.narrator,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
						}).returning();
						narratorId = newNarrator.id;
					}
					narratorCache.set(narratorKey, narratorId);
				}
			}

			// Create the book
			await createBook({
				title: book.title,
				isbn10: book.isbn || null,
				isbn13: book.isbn13 || null,
				goodreadsId: book.goodreadsId || null,
				statusId: book.statusId,
				genreId: book.genreId,
				formatId: book.formatId,
				narratorId: narratorId,
				rating: book.rating,
				startReadingDate: book.startDate || null,
				completedDate: book.completedDate || null,
				releaseDate: book.releaseDate || null,
				publishYear: book.publishYear,
				pageCount: book.pageCount,
				publisher: book.publisher || null,
				summary: book.summary || null,
				comments: book.comments || null,
				bookNum: book.bookNum,
				authors: authorId ? [{ id: authorId }] : [],
				series: seriesId ? [{ id: seriesId, bookNum: book.bookNum || undefined }] : [],
				ownerId: locals.user.id
			});

			results.imported++;
		} catch (e) {
			results.errors.push({
				row: book.rowIndex,
				title: book.title,
				error: e instanceof Error ? e.message : 'Unknown error'
			});
		}
	}

	// Clean up session
	importSessions.delete(sessionId);

	return json(results);
};
