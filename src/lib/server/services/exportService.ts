/**
 * Export Service
 * Handles exporting library data to CSV and JSON formats
 */
import { db } from '$lib/server/db';
import {
	books,
	authors,
	series,
	genres,
	statuses,
	formats,
	narrators,
	tags,
	bookAuthors,
	bookSeries,
	bookTags
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface ExportOptions {
	format: 'csv' | 'json';
	includeAuthors?: boolean;
	includeSeries?: boolean;
	includeTags?: boolean;
	includeGenres?: boolean;
	includeFormats?: boolean;
	includeNarrators?: boolean;
	includeStatuses?: boolean;
	goodreadsCompatible?: boolean;
}

export interface ExportResult {
	data: string;
	filename: string;
	mimeType: string;
	bookCount: number;
}

/**
 * Get all books with their related data for export
 */
async function getBooksForExport() {
	// Get all books
	const allBooks = await db.select().from(books);

	// Get all related data in parallel
	const [
		allAuthors,
		allSeries,
		allGenres,
		allStatuses,
		allFormats,
		allNarrators,
		allTags,
		allBookAuthors,
		allBookSeries,
		allBookTags
	] = await Promise.all([
		db.select().from(authors),
		db.select().from(series),
		db.select().from(genres),
		db.select().from(statuses),
		db.select().from(formats),
		db.select().from(narrators),
		db.select().from(tags),
		db.select().from(bookAuthors),
		db.select().from(bookSeries),
		db.select().from(bookTags)
	]);

	// Create lookup maps
	const authorMap = new Map(allAuthors.map((a) => [a.id, a]));
	const seriesMap = new Map(allSeries.map((s) => [s.id, s]));
	const genreMap = new Map(allGenres.map((g) => [g.id, g]));
	const statusMap = new Map(allStatuses.map((s) => [s.id, s]));
	const formatMap = new Map(allFormats.map((f) => [f.id, f]));
	const narratorMap = new Map(allNarrators.map((n) => [n.id, n]));
	const tagMap = new Map(allTags.map((t) => [t.id, t]));

	// Group junction table data by book ID
	const bookAuthorsMap = new Map<number, typeof allBookAuthors>();
	for (const ba of allBookAuthors) {
		if (!bookAuthorsMap.has(ba.bookId)) {
			bookAuthorsMap.set(ba.bookId, []);
		}
		bookAuthorsMap.get(ba.bookId)!.push(ba);
	}

	const bookSeriesMap = new Map<number, typeof allBookSeries>();
	for (const bs of allBookSeries) {
		if (!bookSeriesMap.has(bs.bookId)) {
			bookSeriesMap.set(bs.bookId, []);
		}
		bookSeriesMap.get(bs.bookId)!.push(bs);
	}

	const bookTagsMap = new Map<number, number[]>();
	for (const bt of allBookTags) {
		if (!bookTagsMap.has(bt.bookId)) {
			bookTagsMap.set(bt.bookId, []);
		}
		bookTagsMap.get(bt.bookId)!.push(bt.tagId);
	}

	// Enrich books with related data
	return allBooks.map((book) => {
		const bookAuthorEntries = bookAuthorsMap.get(book.id) || [];
		const bookSeriesEntries = bookSeriesMap.get(book.id) || [];
		const bookTagIds = bookTagsMap.get(book.id) || [];

		return {
			...book,
			authors: bookAuthorEntries
				.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
				.map((ba) => ({
					...authorMap.get(ba.authorId),
					role: ba.role,
					isPrimary: ba.isPrimary
				})),
			series: bookSeriesEntries
				.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
				.map((bs) => ({
					...seriesMap.get(bs.seriesId),
					bookNum: bs.bookNum,
					bookNumEnd: bs.bookNumEnd,
					isPrimary: bs.isPrimary
				})),
			tags: bookTagIds.map((id) => tagMap.get(id)).filter(Boolean),
			genre: book.genreId ? genreMap.get(book.genreId) : null,
			status: book.statusId ? statusMap.get(book.statusId) : null,
			format: book.formatId ? formatMap.get(book.formatId) : null,
			narrator: book.narratorId ? narratorMap.get(book.narratorId) : null
		};
	});
}

/**
 * Export to JSON format
 */
export async function exportToJson(options: ExportOptions): Promise<ExportResult> {
	const booksData = await getBooksForExport();

	// Build export object
	const exportData: Record<string, unknown> = {
		exportDate: new Date().toISOString(),
		version: '2.0',
		bookCount: booksData.length,
		books: booksData.map((book) => {
			const exportBook: Record<string, unknown> = {
				id: book.id,
				title: book.title,
				rating: book.rating,
				coverImageUrl: book.coverImageUrl,
				summary: book.summary,
				comments: book.comments,
				releaseDate: book.releaseDate,
				startReadingDate: book.startReadingDate,
				completedDate: book.completedDate,
				isbn10: book.isbn10,
				isbn13: book.isbn13,
				asin: book.asin,
				goodreadsId: book.goodreadsId,
				googleBooksId: book.googleBooksId,
				pageCount: book.pageCount,
				publisher: book.publisher,
				publishYear: book.publishYear,
				language: book.language,
				edition: book.edition,
				purchasePrice: book.purchasePrice,
				dnfPage: book.dnfPage,
				dnfPercent: book.dnfPercent,
				dnfReason: book.dnfReason,
				dnfDate: book.dnfDate,
				createdAt: book.createdAt,
				updatedAt: book.updatedAt
			};

			// Include related entities based on options
			if (options.includeAuthors !== false) {
				exportBook.authors = book.authors.map((a) => ({
					name: a?.name,
					role: a?.role,
					isPrimary: a?.isPrimary
				}));
			}

			if (options.includeSeries !== false) {
				exportBook.series = book.series.map((s) => ({
					title: s?.title,
					bookNum: s?.bookNum,
					bookNumEnd: s?.bookNumEnd,
					isPrimary: s?.isPrimary
				}));
			}

			if (options.includeTags !== false) {
				exportBook.tags = book.tags.map((t) => t?.name).filter(Boolean);
			}

			if (options.includeGenres !== false && book.genre) {
				exportBook.genre = book.genre.name;
			}

			if (options.includeStatuses !== false && book.status) {
				exportBook.status = book.status.name;
			}

			if (options.includeFormats !== false && book.format) {
				exportBook.format = book.format.name;
			}

			if (options.includeNarrators !== false && book.narrator) {
				exportBook.narrator = book.narrator.name;
			}

			return exportBook;
		})
	};

	// Include entity lists if requested
	if (options.includeAuthors !== false) {
		const allAuthors = await db.select().from(authors);
		exportData.authors = allAuthors;
	}

	if (options.includeSeries !== false) {
		const allSeries = await db.select().from(series);
		exportData.series = allSeries;
	}

	if (options.includeTags !== false) {
		const allTags = await db.select().from(tags);
		exportData.tags = allTags;
	}

	if (options.includeGenres !== false) {
		const allGenres = await db.select().from(genres);
		exportData.genres = allGenres;
	}

	if (options.includeFormats !== false) {
		const allFormats = await db.select().from(formats);
		exportData.formats = allFormats;
	}

	if (options.includeNarrators !== false) {
		const allNarrators = await db.select().from(narrators);
		exportData.narrators = allNarrators;
	}

	if (options.includeStatuses !== false) {
		const allStatuses = await db.select().from(statuses);
		exportData.statuses = allStatuses;
	}

	const dateStr = new Date().toISOString().split('T')[0];

	return {
		data: JSON.stringify(exportData, null, 2),
		filename: `bookshelf-export-${dateStr}.json`,
		mimeType: 'application/json',
		bookCount: booksData.length
	};
}

/**
 * Escape CSV field (handle quotes and commas)
 */
function escapeCSV(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return '';
	}
	const str = String(value);
	// If contains comma, quote, or newline, wrap in quotes and escape inner quotes
	if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Export to CSV format
 */
export async function exportToCsv(options: ExportOptions): Promise<ExportResult> {
	const booksData = await getBooksForExport();

	let headers: string[];
	let rows: string[][];

	if (options.goodreadsCompatible) {
		// Goodreads-compatible format
		headers = [
			'Book Id',
			'Title',
			'Author',
			'Author l-f',
			'Additional Authors',
			'ISBN',
			'ISBN13',
			'My Rating',
			'Average Rating',
			'Publisher',
			'Binding',
			'Number of Pages',
			'Year Published',
			'Original Publication Year',
			'Date Read',
			'Date Added',
			'Bookshelves',
			'Bookshelves with positions',
			'Exclusive Shelf',
			'My Review',
			'Spoiler',
			'Private Notes',
			'Read Count',
			'Owned Copies'
		];

		rows = booksData.map((book) => {
			const primaryAuthor = book.authors.find((a) => a?.isPrimary) || book.authors[0];
			const additionalAuthors = book.authors
				.filter((a) => a !== primaryAuthor)
				.map((a) => a?.name)
				.filter(Boolean)
				.join(', ');

			// Format author name as "Last, First" for Author l-f column
			const authorName = primaryAuthor?.name || '';
			const authorLF = formatAuthorLastFirst(authorName);

			// Map status to Goodreads shelf
			let exclusiveShelf = 'to-read';
			if (book.status?.key === 'READ') exclusiveShelf = 'read';
			else if (book.status?.key === 'CURRENT') exclusiveShelf = 'currently-reading';

			// Get all tag names as bookshelves
			const bookshelves = book.tags.map((t) => t?.name).filter(Boolean).join(', ');

			return [
				book.goodreadsId || '',
				book.title,
				authorName,
				authorLF,
				additionalAuthors,
				book.isbn10 || '',
				book.isbn13 || '',
				book.rating?.toString() || '',
				'', // Average Rating - not tracked
				book.publisher || '',
				book.format?.name || '',
				book.pageCount?.toString() || '',
				book.publishYear?.toString() || '',
				book.releaseDate ? new Date(book.releaseDate).getFullYear().toString() : '',
				book.completedDate || '',
				book.createdAt || '',
				bookshelves,
				'', // Bookshelves with positions - not tracked
				exclusiveShelf,
				book.comments || '',
				'', // Spoiler - not tracked
				book.summary || '',
				book.completedDate ? '1' : '0',
				'0' // Owned Copies - not tracked
			];
		});
	} else {
		// Full BookShelf format
		headers = [
			'Title',
			'Authors',
			'Series',
			'Series Number',
			'Rating',
			'Status',
			'Genre',
			'Format',
			'Narrator',
			'Tags',
			'ISBN10',
			'ISBN13',
			'ASIN',
			'Goodreads ID',
			'Page Count',
			'Publisher',
			'Publish Year',
			'Release Date',
			'Language',
			'Edition',
			'Start Date',
			'Completed Date',
			'Summary',
			'Comments',
			'Cover URL',
			'Purchase Price',
			'DNF Page',
			'DNF Reason',
			'DNF Date',
			'Created At',
			'Updated At'
		];

		rows = booksData.map((book) => {
			// Join multiple authors with semicolons
			const authorsStr = book.authors
				.map((a) => {
					let str = a?.name || '';
					if (a?.role && a.role !== 'Author') {
						str += ` (${a.role})`;
					}
					return str;
				})
				.filter(Boolean)
				.join('; ');

			// Get primary series
			const primarySeries = book.series.find((s) => s?.isPrimary) || book.series[0];
			const seriesStr = primarySeries?.title || '';
			const seriesNumStr = primarySeries?.bookNum?.toString() || '';

			// Join tags with semicolons
			const tagsStr = book.tags.map((t) => t?.name).filter(Boolean).join('; ');

			return [
				book.title,
				authorsStr,
				seriesStr,
				seriesNumStr,
				book.rating?.toString() || '',
				book.status?.name || '',
				book.genre?.name || '',
				book.format?.name || '',
				book.narrator?.name || '',
				tagsStr,
				book.isbn10 || '',
				book.isbn13 || '',
				book.asin || '',
				book.goodreadsId || '',
				book.pageCount?.toString() || '',
				book.publisher || '',
				book.publishYear?.toString() || '',
				book.releaseDate || '',
				book.language || '',
				book.edition || '',
				book.startReadingDate || '',
				book.completedDate || '',
				book.summary || '',
				book.comments || '',
				book.coverImageUrl || book.originalCoverUrl || '',
				book.purchasePrice?.toString() || '',
				book.dnfPage?.toString() || '',
				book.dnfReason || '',
				book.dnfDate || '',
				book.createdAt || '',
				book.updatedAt || ''
			];
		});
	}

	// Build CSV string
	const csvLines = [
		headers.map(escapeCSV).join(','),
		...rows.map((row) => row.map(escapeCSV).join(','))
	];

	const dateStr = new Date().toISOString().split('T')[0];
	const filename = options.goodreadsCompatible
		? `goodreads-export-${dateStr}.csv`
		: `bookshelf-export-${dateStr}.csv`;

	return {
		data: csvLines.join('\n'),
		filename,
		mimeType: 'text/csv',
		bookCount: booksData.length
	};
}

/**
 * Format author name as "Last, First"
 */
function formatAuthorLastFirst(name: string): string {
	if (!name) return '';
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return name;
	const last = parts.pop()!;
	return `${last}, ${parts.join(' ')}`;
}

/**
 * Main export function
 */
export async function exportLibrary(options: ExportOptions): Promise<ExportResult> {
	if (options.format === 'json') {
		return exportToJson(options);
	} else {
		return exportToCsv(options);
	}
}
