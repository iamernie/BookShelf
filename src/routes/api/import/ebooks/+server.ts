import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import {
	extractEbookMetadata,
	saveCoverImage,
	saveEbookFile,
	type ExtractedEbook,
	type SaveContext
} from '$lib/server/services/ebookMetadataService';
import { db } from '$lib/server/db';
import { books, authors, bookAuthors, formats, statuses, genres, series, bookSeries } from '$lib/server/db/schema';
import { eq, like } from 'drizzle-orm';

// Store pending imports in memory (in production, use Redis or similar)
const pendingImports = new Map<string, ExtractedEbook[]>();

// POST: Upload and extract metadata from ebook files
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const formData = await request.formData();
	const files = formData.getAll('files') as File[];

	if (!files || files.length === 0) {
		throw error(400, 'No files provided');
	}

	// Validate file types
	const validExtensions = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.cbr'];
	for (const file of files) {
		const ext = path.extname(file.name).toLowerCase();
		if (!validExtensions.includes(ext)) {
			throw error(400, `Invalid file type: ${file.name}. Supported: ${validExtensions.join(', ')}`);
		}
	}

	const tempDir = '/tmp/bookshelf-uploads';
	await mkdir(tempDir, { recursive: true });

	const extractedBooks: ExtractedEbook[] = [];

	for (const file of files) {
		// Save to temp file
		const tempFilename = `${randomBytes(8).toString('hex')}_${file.name}`;
		const tempPath = path.join(tempDir, tempFilename);

		const arrayBuffer = await file.arrayBuffer();
		await writeFile(tempPath, Buffer.from(arrayBuffer));

		try {
			// Extract metadata
			const extracted = await extractEbookMetadata(tempPath, file.name);
			extractedBooks.push(extracted);
		} catch (e) {
			// Clean up on error
			try {
				await unlink(tempPath);
			} catch {
				// Ignore
			}
			console.error(`Error extracting metadata from ${file.name}:`, e);
			// Continue with other files
		}
	}

	if (extractedBooks.length === 0) {
		throw error(400, 'No valid ebook files could be processed');
	}

	// Generate session ID and store pending imports
	const sessionId = randomBytes(16).toString('hex');
	pendingImports.set(sessionId, extractedBooks);

	// Clean up old sessions after 1 hour
	setTimeout(() => {
		const session = pendingImports.get(sessionId);
		if (session) {
			// Clean up temp files
			for (const book of session) {
				unlink(book.tempPath).catch(() => {});
			}
			pendingImports.delete(sessionId);
		}
	}, 60 * 60 * 1000);

	// Return preview data (without cover images - send separately)
	const previewBooks = extractedBooks.map((book, index) => ({
		index,
		originalFilename: book.originalFilename,
		format: book.format,
		fileSize: book.fileSize,
		title: book.metadata.title,
		authors: book.metadata.authors,
		publisher: book.metadata.publisher,
		isbn: book.metadata.isbn,
		description: book.metadata.description,
		subjects: book.metadata.subjects,  // genres
		series: book.metadata.series,
		seriesNumber: book.metadata.seriesNumber,
		hasCover: !!book.metadata.coverImage
	}));

	return json({
		sessionId,
		books: previewBooks,
		totalSize: extractedBooks.reduce((sum, b) => sum + b.fileSize, 0)
	});
};

// GET: Get cover image for a pending import
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const sessionId = url.searchParams.get('sessionId');
	const indexStr = url.searchParams.get('index');

	if (!sessionId || !indexStr) {
		throw error(400, 'Missing sessionId or index');
	}

	const session = pendingImports.get(sessionId);
	if (!session) {
		throw error(404, 'Session not found or expired');
	}

	const index = parseInt(indexStr, 10);
	if (isNaN(index) || index < 0 || index >= session.length) {
		throw error(400, 'Invalid index');
	}

	const book = session[index];
	if (!book.metadata.coverImage) {
		throw error(404, 'No cover image available');
	}

	return new Response(new Uint8Array(book.metadata.coverImage), {
		headers: {
			'Content-Type': book.metadata.coverMimeType || 'image/jpeg',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

// PUT: Execute the import
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { sessionId, selectedIndexes, bookData } = body;

	if (!sessionId || !selectedIndexes || !Array.isArray(selectedIndexes)) {
		throw error(400, 'Invalid request');
	}

	const session = pendingImports.get(sessionId);
	if (!session) {
		throw error(404, 'Session not found or expired');
	}

	const results = {
		imported: 0,
		errors: [] as { filename: string; error: string }[]
	};

	for (const index of selectedIndexes) {
		if (index < 0 || index >= session.length) continue;

		const extracted = session[index];
		const customData = bookData?.[index] || {};

		try {
			// Get or create format
			let formatId: number | null = null;
			const formatName = extracted.format.toUpperCase();
			const existingFormat = await db.select().from(formats).where(eq(formats.name, formatName)).get();

			if (existingFormat) {
				formatId = existingFormat.id;
			} else {
				const newFormat = await db.insert(formats).values({ name: formatName }).returning().get();
				formatId = newFormat.id;
			}

			// Get author and title for path context
			const bookTitle = customData.title || extracted.metadata.title || extracted.originalFilename;
			const authorNames = customData.authors || extracted.metadata.authors;
			const primaryAuthor = authorNames.length > 0 ? authorNames[0] : undefined;

			// Create save context for path patterns
			const saveContext: SaveContext = {
				title: bookTitle,
				author: primaryAuthor,
				series: customData.series || undefined
			};

			// Save cover image if present
			let coverPath: string | null = null;
			if (extracted.metadata.coverImage && extracted.metadata.coverMimeType) {
				coverPath = await saveCoverImage(
					extracted.metadata.coverImage,
					extracted.metadata.coverMimeType,
					saveContext
				);
			}

			// Save ebook file
			const ebookPath = await saveEbookFile(extracted.tempPath, extracted.originalFilename, saveContext);

			// Get or create author(s)
			const authorIds: number[] = [];

			for (const authorName of authorNames) {
				if (!authorName) continue;

				// Try to find existing author
				const existingAuthor = await db.select().from(authors)
					.where(like(authors.name, authorName))
					.get();

				if (existingAuthor) {
					authorIds.push(existingAuthor.id);
				} else {
					// Create new author
					const newAuthor = await db.insert(authors).values({
						name: authorName
					}).returning().get();
					authorIds.push(newAuthor.id);
				}
			}

			// Create book
			const isbn = customData.isbn || extracted.metadata.isbn;
			const now = new Date().toISOString();

			// Get default status (Unread)
			const unreadStatus = await db.select().from(statuses)
				.where(eq(statuses.key, 'UNREAD'))
				.get();

			// Try to match first subject to existing genre
			let genreId: number | null = null;
			const subjects = extracted.metadata.subjects || [];
			for (const subject of subjects) {
				const existingGenre = await db.select().from(genres)
					.where(like(genres.name, subject))
					.get();
				if (existingGenre) {
					genreId = existingGenre.id;
					break;
				}
			}

			const newBook = await db.insert(books).values({
				title: bookTitle,
				coverImageUrl: coverPath,
				formatId,
				genreId,
				ebookPath,
				statusId: unreadStatus?.id || null,
				isbn13: isbn && isbn.length === 13 ? isbn : null,
				isbn10: isbn && isbn.length === 10 ? isbn : null,
				publisher: customData.publisher || extracted.metadata.publisher,
				summary: customData.description || extracted.metadata.description,
				createdAt: now,
				updatedAt: now
			}).returning().get();

			// Link authors
			for (const authorId of authorIds) {
				await db.insert(bookAuthors).values({
					bookId: newBook.id,
					authorId,
					createdAt: now,
					updatedAt: now
				}).onConflictDoNothing();
			}

			// Handle series from metadata
			const seriesName = customData.series || extracted.metadata.series;
			const seriesNum = customData.seriesNumber || extracted.metadata.seriesNumber;

			if (seriesName) {
				// Find or create series
				let seriesRecord = await db.select().from(series)
					.where(like(series.title, seriesName))
					.get();

				if (!seriesRecord) {
					seriesRecord = await db.insert(series).values({
						title: seriesName,
						createdAt: now,
						updatedAt: now
					}).returning().get();
				}

				// Link book to series
				await db.insert(bookSeries).values({
					bookId: newBook.id,
					seriesId: seriesRecord.id,
					bookNum: seriesNum || undefined,
					createdAt: now,
					updatedAt: now
				}).onConflictDoNothing();
			}

			results.imported++;
		} catch (e) {
			console.error(`Error importing ${extracted.originalFilename}:`, e);
			results.errors.push({
				filename: extracted.originalFilename,
				error: e instanceof Error ? e.message : 'Unknown error'
			});
		}
	}

	// Clean up remaining temp files
	for (const book of session) {
		try {
			await unlink(book.tempPath);
		} catch {
			// Ignore
		}
	}

	// Remove session
	pendingImports.delete(sessionId);

	return json(results);
};

// DELETE: Cancel import and clean up
export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const sessionId = url.searchParams.get('sessionId');
	if (!sessionId) {
		throw error(400, 'Missing sessionId');
	}

	const session = pendingImports.get(sessionId);
	if (session) {
		// Clean up temp files
		for (const book of session) {
			try {
				await unlink(book.tempPath);
			} catch {
				// Ignore
			}
		}
		pendingImports.delete(sessionId);
	}

	return json({ success: true });
};
