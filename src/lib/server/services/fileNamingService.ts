/**
 * File Naming Service
 * Generates file paths from book metadata using configurable patterns
 */

import { db } from '$lib/server/db';
import { books, bookAuthors, authors, bookSeries, series, genres } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getStoragePaths, resolvePathPattern, type PathPatternContext } from './settingsService';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BookForNaming {
	id: number;
	title: string;
	subtitle?: string | null;
	publishYear?: number | null;
	isbn13?: string | null;
	language?: string | null;
	ebookFormat?: string | null;
	ebookPath?: string | null;
	coverImageUrl?: string | null;
	genreId?: number | null;
}

export interface BookRelationsForNaming {
	authors: Array<{ id: number; name: string }>;
	series: Array<{ id: number; title: string; bookNum?: number | null }>;
	genre?: { id: number; name: string } | null;
}

/**
 * Build PathPatternContext from book data and its relations
 */
export function buildPatternContext(
	book: BookForNaming,
	relations: BookRelationsForNaming,
	originalFilename?: string
): PathPatternContext {
	const primaryAuthor = relations.authors[0];
	const primarySeries = relations.series[0];

	return {
		author: primaryAuthor?.name,
		authors: relations.authors.map(a => a.name).join(', '),
		series: primarySeries?.title,
		seriesIndex: primarySeries?.bookNum?.toString(),
		title: book.title,
		subtitle: book.subtitle || undefined,
		year: book.publishYear?.toString(),
		format: book.ebookFormat || undefined,
		genre: relations.genre?.name,
		language: book.language || undefined,
		isbn: book.isbn13 || undefined,
		filename: originalFilename
	};
}

/**
 * Fetch book relations needed for naming
 */
export async function getBookRelationsForNaming(bookId: number): Promise<BookRelationsForNaming> {
	// Get authors
	const bookAuthorRows = await db
		.select({
			id: authors.id,
			name: authors.name
		})
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, bookId));

	// Get series
	const bookSeriesRows = await db
		.select({
			id: series.id,
			title: series.title,
			bookNum: bookSeries.bookNum
		})
		.from(bookSeries)
		.innerJoin(series, eq(bookSeries.seriesId, series.id))
		.where(eq(bookSeries.bookId, bookId));

	// Get genre from book's genreId
	const [book] = await db
		.select({ genreId: books.genreId })
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	let genre: { id: number; name: string } | null = null;
	if (book?.genreId) {
		const [genreRow] = await db
			.select({ id: genres.id, name: genres.name })
			.from(genres)
			.where(eq(genres.id, book.genreId))
			.limit(1);
		genre = genreRow || null;
	}

	return {
		authors: bookAuthorRows,
		series: bookSeriesRows,
		genre
	};
}

/**
 * Generate the target file path for an ebook based on current pattern settings
 */
export async function generateEbookPath(
	book: BookForNaming,
	relations: BookRelationsForNaming,
	originalFilename: string
): Promise<string> {
	const { ebooksPath, ebookPathPattern } = await getStoragePaths();
	const context = buildPatternContext(book, relations, originalFilename);

	// Get file extension from original filename
	const ext = path.extname(originalFilename);
	const baseName = path.basename(originalFilename, ext);

	// Resolve the pattern
	let resolvedPath = resolvePathPattern(ebookPathPattern, { ...context, filename: baseName });

	// Add extension back
	resolvedPath = resolvedPath + ext.toLowerCase();

	// Combine with base path
	return path.join(ebooksPath, resolvedPath);
}

/**
 * Generate the target file path for a cover image based on current pattern settings
 */
export async function generateCoverPath(
	book: BookForNaming,
	relations: BookRelationsForNaming,
	originalFilename: string
): Promise<string> {
	const { coversPath, coverPathPattern } = await getStoragePaths();
	const context = buildPatternContext(book, relations, originalFilename);

	// Get file extension from original filename
	const ext = path.extname(originalFilename);
	const baseName = path.basename(originalFilename, ext);

	// Resolve the pattern
	let resolvedPath = resolvePathPattern(coverPathPattern, { ...context, filename: baseName });

	// Add extension back
	resolvedPath = resolvedPath + ext.toLowerCase();

	// Combine with base path
	return path.join(coversPath, resolvedPath);
}

/**
 * Move/rename a file to match the current naming pattern
 * Returns the new path, or null if no move was needed
 */
export async function organizeFile(
	currentPath: string,
	targetPath: string
): Promise<{ moved: boolean; newPath: string }> {
	// Normalize paths
	const normalizedCurrent = path.normalize(currentPath);
	const normalizedTarget = path.normalize(targetPath);

	// If paths are the same, no move needed
	if (normalizedCurrent === normalizedTarget) {
		return { moved: false, newPath: normalizedCurrent };
	}

	// Ensure target directory exists
	const targetDir = path.dirname(normalizedTarget);
	await fs.mkdir(targetDir, { recursive: true });

	// Check if target already exists
	try {
		await fs.access(normalizedTarget);
		// Target exists - add timestamp to avoid collision
		const ext = path.extname(normalizedTarget);
		const base = path.basename(normalizedTarget, ext);
		const timestamp = Date.now();
		const newTarget = path.join(targetDir, `${base}_${timestamp}${ext}`);
		await fs.rename(normalizedCurrent, newTarget);
		return { moved: true, newPath: newTarget };
	} catch {
		// Target doesn't exist, safe to move
		await fs.rename(normalizedCurrent, normalizedTarget);
		return { moved: true, newPath: normalizedTarget };
	}
}

/**
 * Reorganize a book's files based on current patterns
 * Updates the database with new paths
 */
export async function reorganizeBookFiles(bookId: number): Promise<{
	ebookMoved: boolean;
	coverMoved: boolean;
	newEbookPath?: string;
	newCoverPath?: string;
}> {
	// Fetch book data
	const [book] = await db
		.select()
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		throw new Error(`Book ${bookId} not found`);
	}

	const relations = await getBookRelationsForNaming(bookId);

	let ebookMoved = false;
	let coverMoved = false;
	let newEbookPath: string | undefined;
	let newCoverPath: string | undefined;

	// Reorganize ebook if exists
	if (book.ebookPath) {
		const originalFilename = path.basename(book.ebookPath);
		const targetPath = await generateEbookPath(book, relations, originalFilename);

		try {
			const result = await organizeFile(book.ebookPath, targetPath);
			if (result.moved) {
				ebookMoved = true;
				newEbookPath = result.newPath;
				// Update database
				await db
					.update(books)
					.set({ ebookPath: newEbookPath })
					.where(eq(books.id, bookId));
			}
		} catch (err) {
			console.error(`Failed to reorganize ebook for book ${bookId}:`, err);
		}
	}

	// Reorganize cover if exists (covers are stored as URLs, not local paths typically)
	// Only reorganize if it's a local file path (not a URL)
	if (book.coverImageUrl && !book.coverImageUrl.startsWith('http')) {
		const originalFilename = path.basename(book.coverImageUrl);
		const targetPath = await generateCoverPath(book, relations, originalFilename);

		try {
			const result = await organizeFile(book.coverImageUrl, targetPath);
			if (result.moved) {
				coverMoved = true;
				newCoverPath = result.newPath;
				// Update database
				await db
					.update(books)
					.set({ coverImageUrl: newCoverPath })
					.where(eq(books.id, bookId));
			}
		} catch (err) {
			console.error(`Failed to reorganize cover for book ${bookId}:`, err);
		}
	}

	return { ebookMoved, coverMoved, newEbookPath, newCoverPath };
}

/**
 * Preview what the file path would be for a book (without moving files)
 */
export async function previewFilePath(
	book: BookForNaming,
	relations: BookRelationsForNaming,
	fileType: 'ebook' | 'cover',
	filename: string
): Promise<string> {
	if (fileType === 'ebook') {
		return generateEbookPath(book, relations, filename);
	} else {
		return generateCoverPath(book, relations, filename);
	}
}

/**
 * Preview a pattern with example data
 */
export function previewPatternWithExample(pattern: string): string {
	const exampleContext: PathPatternContext = {
		author: 'Brandon Sanderson',
		authors: 'Brandon Sanderson',
		series: 'The Stormlight Archive',
		seriesIndex: '1',
		title: 'The Way of Kings',
		subtitle: 'Part One',
		year: '2010',
		format: 'epub',
		genre: 'Fantasy',
		publisher: 'Tor Books',
		language: 'en',
		isbn: '9780765326355',
		filename: 'the_way_of_kings'
	};

	return resolvePathPattern(pattern, exampleContext);
}
