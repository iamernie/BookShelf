/**
 * Audible Import API
 * POST - Upload and parse Audible HTML, return preview
 * PUT - Execute import with selected books
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseAudibleHtml, calculateStartDate, isDateInPast, type AudibleBook } from '$lib/server/services/audibleImportService';
import { db } from '$lib/server/db';
import { books, authors, series, narrators, formats, statuses, genres, bookAuthors, bookSeries, userBooks } from '$lib/server/db/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { fuzzyMatch } from '$lib/server/services/importService';

// In-memory session storage for parsed data
const audibleSessions = new Map<string, { books: AudibleBook[]; timestamp: number }>();

// Clean old sessions (older than 30 minutes)
function cleanOldSessions() {
	const now = Date.now();
	for (const [id, session] of audibleSessions) {
		if (now - session.timestamp > 30 * 60 * 1000) {
			audibleSessions.delete(id);
		}
	}
}

/**
 * POST - Upload Audible HTML and get preview
 */
export const POST: RequestHandler = async ({ request }) => {
	cleanOldSessions();

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file uploaded');
	}

	// Read file content
	const htmlContent = await file.text();

	// Parse the HTML
	const parsedBooks = parseAudibleHtml(htmlContent);

	if (parsedBooks.length === 0) {
		throw error(400, 'No books found in the uploaded file. Make sure you exported your Audible listening history page.');
	}

	// Get existing data for duplicate detection and dropdowns
	const [existingBooks, allAuthors, allSeries, allNarrators, allFormats, allStatuses, allGenres] = await Promise.all([
		db.select({
			id: books.id,
			title: books.title,
			asin: books.asin
		}).from(books),
		db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(authors.name),
		db.select({ id: series.id, title: series.title }).from(series).orderBy(series.title),
		db.select({ id: narrators.id, name: narrators.name }).from(narrators).orderBy(narrators.name),
		db.select({ id: formats.id, name: formats.name }).from(formats).orderBy(formats.name),
		db.select({ id: statuses.id, name: statuses.name, key: statuses.key }).from(statuses).orderBy(statuses.id),
		db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(genres.name)
	]);

	// Find Audiobook format for default
	const audiobookFormat = allFormats.find(f => f.name.toLowerCase() === 'audiobook');
	const defaultFormatId = audiobookFormat?.id || null;

	// Find "Done" status for default when listen date is in the past
	// Use key for reliable lookup (key stays constant even if user renames the status)
	const doneStatus = allStatuses.find(s => s.key === 'READ');
	const unreadStatus = allStatuses.find(s => s.key === 'NEXT' || s.name.toLowerCase() === 'to-read' || s.name.toLowerCase() === 'unread');
	const defaultDoneStatusId = doneStatus?.id || null;
	const defaultUnreadStatusId = unreadStatus?.id || null;

	// Check each book for duplicates
	const booksWithDupeCheck = parsedBooks.map((book, index) => {
		// First check by ASIN (most reliable)
		let isDuplicate = false;
		let duplicateBookId: number | null = null;

		if (book.asin) {
			const asinMatch = existingBooks.find(eb => eb.asin === book.asin);
			if (asinMatch) {
				isDuplicate = true;
				duplicateBookId = asinMatch.id;
			}
		}

		// If no ASIN match, use fuzzy title matching
		if (!isDuplicate) {
			for (const existing of existingBooks) {
				if (fuzzyMatch(book.title, existing.title) >= 0.85) {
					isDuplicate = true;
					duplicateBookId = existing.id;
					break;
				}
			}
		}

		// Default status: Done if listen date is in the past, otherwise Unread
		const defaultStatusId = isDateInPast(book.listenDate)
			? defaultDoneStatusId
			: defaultUnreadStatusId;

		return {
			rowIndex: index,
			...book,
			seriesName: '',
			seriesId: null as number | null,
			bookNum: null as number | null,
			narratorName: '',
			narratorId: null as number | null,
			genreId: null as number | null,
			formatId: defaultFormatId,
			statusId: defaultStatusId,
			isDuplicate,
			duplicateBookId,
			isRead: isDateInPast(book.listenDate)
		};
	});

	// Generate session ID
	const sessionId = crypto.randomUUID();
	audibleSessions.set(sessionId, { books: parsedBooks, timestamp: Date.now() });

	return json({
		sessionId,
		totalBooks: parsedBooks.length,
		duplicates: booksWithDupeCheck.filter(b => b.isDuplicate).length,
		newBooks: booksWithDupeCheck.filter(b => !b.isDuplicate).length,
		books: booksWithDupeCheck,
		// Dropdown options
		authors: allAuthors,
		series: allSeries,
		narrators: allNarrators,
		genres: allGenres,
		formats: allFormats,
		statuses: allStatuses
	});
};

/**
 * PUT - Execute import with selected books
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { sessionId, selectedRows, booksData, downloadCovers = true } = body;

	if (!sessionId || !audibleSessions.has(sessionId)) {
		throw error(400, 'Invalid or expired session');
	}

	if (!selectedRows || !Array.isArray(selectedRows) || selectedRows.length === 0) {
		throw error(400, 'No books selected for import');
	}

	// Get or create the "Audiobook" format
	let audiobookFormat = await db.select().from(formats).where(eq(formats.name, 'Audiobook')).get();
	if (!audiobookFormat) {
		const result = await db.insert(formats).values({ name: 'Audiobook' }).returning();
		audiobookFormat = result[0];
	}

	const results = {
		imported: 0,
		skipped: 0,
		errors: [] as { row: number; title: string; error: string }[]
	};

	// Import each selected book
	for (const rowIndex of selectedRows) {
		const bookData = booksData?.find((b: any) => b.rowIndex === rowIndex);
		if (!bookData) {
			results.skipped++;
			continue;
		}

		try {
			// Handle author - use existing ID if provided, otherwise create new
			let authorId: number | null = null;
			if (bookData.authorId) {
				authorId = bookData.authorId;
			} else if (bookData.author && bookData.author.trim()) {
				// Check if author exists
				const existingAuthor = await db.select()
					.from(authors)
					.where(eq(authors.name, bookData.author.trim()))
					.get();

				if (existingAuthor) {
					authorId = existingAuthor.id;
				} else {
					// Create new author
					const newAuthor = await db.insert(authors)
						.values({ name: bookData.author.trim() })
						.returning();
					authorId = newAuthor[0].id;
				}
			}

			// Handle series
			let seriesId: number | null = null;
			if (bookData.seriesId) {
				seriesId = bookData.seriesId;
			} else if (bookData.seriesName && bookData.seriesName.trim()) {
				const existingSeries = await db.select()
					.from(series)
					.where(eq(series.title, bookData.seriesName.trim()))
					.get();

				if (existingSeries) {
					seriesId = existingSeries.id;
				} else {
					const newSeries = await db.insert(series)
						.values({ title: bookData.seriesName.trim() })
						.returning();
					seriesId = newSeries[0].id;
				}
			}

			// Handle narrator
			let narratorId: number | null = null;
			if (bookData.narratorId) {
				narratorId = bookData.narratorId;
			} else if (bookData.narratorName && bookData.narratorName.trim()) {
				const existingNarrator = await db.select()
					.from(narrators)
					.where(eq(narrators.name, bookData.narratorName.trim()))
					.get();

				if (existingNarrator) {
					narratorId = existingNarrator.id;
				} else {
					const newNarrator = await db.insert(narrators)
						.values({ name: bookData.narratorName.trim() })
						.returning();
					narratorId = newNarrator[0].id;
				}
			}

			// Parse dates
			const completedDate = bookData.listenDate || null;
			const startReadingDate = calculateStartDate(completedDate);

			// Use format from form data, or default to Audiobook
			const formatId = bookData.formatId || audiobookFormat?.id || null;

			// Handle cover image
			let coverImageUrl: string | null = null;
			let originalCoverUrl = bookData.imageUrl || null;

			if (downloadCovers && originalCoverUrl && originalCoverUrl.startsWith('http')) {
				// For now, just store the original URL - cover download can happen later
				// or we can implement it in a separate service
				coverImageUrl = null; // Will use originalCoverUrl as fallback
			}

			const now = new Date().toISOString();

			// Create the book
			const newBook = await db.insert(books).values({
				title: bookData.title,
				narratorId,
				genreId: bookData.genreId || null,
				formatId,
				statusId: bookData.statusId || null,
				startReadingDate,
				completedDate,
				coverImageUrl,
				originalCoverUrl,
				asin: bookData.asin || null,
				ownerId: locals.user.id,
				createdAt: now,
				updatedAt: now
			}).returning();

			const bookId = newBook[0].id;

			// Add book to user's personal library (user_books table)
			await db.insert(userBooks).values({
				userId: locals.user.id,
				bookId,
				statusId: bookData.statusId || null,
				startReadingDate,
				completedDate,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			});

			// Add author to junction table
			if (authorId) {
				await db.insert(bookAuthors).values({
					bookId,
					authorId,
					role: 'Author',
					isPrimary: true,
					displayOrder: 0,
					createdAt: now,
					updatedAt: now
				});
			}

			// Add series to junction table
			if (seriesId) {
				await db.insert(bookSeries).values({
					bookId,
					seriesId,
					bookNum: bookData.bookNum || null,
					isPrimary: true,
					displayOrder: 0,
					createdAt: now,
					updatedAt: now
				});
			}

			results.imported++;
		} catch (bookError) {
			console.error('Error importing book:', bookData.title, bookError);
			results.errors.push({
				row: rowIndex,
				title: bookData.title,
				error: bookError instanceof Error ? bookError.message : 'Unknown error'
			});
			results.skipped++;
		}
	}

	// Clean up session
	audibleSessions.delete(sessionId);

	return json({
		success: true,
		...results,
		message: `Successfully imported ${results.imported} book(s)`
	});
};
