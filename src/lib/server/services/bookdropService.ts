import { db, bookdropQueue, bookdropSettings, books, authors, bookAuthors, formats, statuses } from '$lib/server/db';
import { eq, and, desc, asc, isNull, sql } from 'drizzle-orm';
import { extractEbookMetadata, saveCoverImage, saveEbookFile, type EbookMetadata } from './ebookMetadataService';
import { createHash } from 'crypto';
import { readFile, unlink, rename, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { BookdropQueueItem, BookdropSettings, LibraryType } from '$lib/server/db/schema';

// Types for BookDrop
export interface QueueItemWithMetadata extends BookdropQueueItem {
	parsedMetadata: EbookMetadata | null;
}

export interface BookdropStats {
	pending: number;
	processing: number;
	imported: number;
	failed: number;
	skipped: number;
}

// ============================================================================
// Settings Management
// ============================================================================

export async function getSettings(userId?: number): Promise<BookdropSettings | null> {
	// First try user-specific settings
	if (userId) {
		const userSettings = await db
			.select()
			.from(bookdropSettings)
			.where(eq(bookdropSettings.userId, userId))
			.limit(1);
		if (userSettings[0]) return userSettings[0];
	}

	// Fall back to global settings (userId is null)
	const globalSettings = await db
		.select()
		.from(bookdropSettings)
		.where(isNull(bookdropSettings.userId))
		.limit(1);

	return globalSettings[0] || null;
}

export async function saveSettings(
	settings: Partial<BookdropSettings>,
	userId?: number
): Promise<BookdropSettings> {
	const now = new Date().toISOString();
	const existing = await getSettings(userId);

	if (existing) {
		await db
			.update(bookdropSettings)
			.set({ ...settings, updatedAt: now })
			.where(eq(bookdropSettings.id, existing.id));

		return { ...existing, ...settings, updatedAt: now };
	} else {
		const [newSettings] = await db
			.insert(bookdropSettings)
			.values({
				userId: userId || null,
				...settings,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		return newSettings;
	}
}

// ============================================================================
// Queue Management
// ============================================================================

export async function getQueueItems(
	userId?: number,
	status?: string,
	limit = 100
): Promise<QueueItemWithMetadata[]> {
	let query = db.select().from(bookdropQueue);

	const conditions = [];
	if (userId) conditions.push(eq(bookdropQueue.userId, userId));
	if (status) conditions.push(eq(bookdropQueue.status, status));

	if (conditions.length > 0) {
		query = query.where(and(...conditions)) as typeof query;
	}

	const items = await query.orderBy(desc(bookdropQueue.createdAt)).limit(limit);

	// Parse metadata JSON for each item
	return items.map((item) => ({
		...item,
		parsedMetadata: item.metadata ? JSON.parse(item.metadata) : null
	}));
}

export async function getQueueStats(userId?: number): Promise<BookdropStats> {
	const baseQuery = userId
		? sql`WHERE ${bookdropQueue.userId} = ${userId}`
		: sql``;

	const stats = await db.all<{ status: string; count: number }>(sql`
		SELECT status, COUNT(*) as count
		FROM ${bookdropQueue}
		${baseQuery}
		GROUP BY status
	`);

	const result: BookdropStats = {
		pending: 0,
		processing: 0,
		imported: 0,
		failed: 0,
		skipped: 0
	};

	for (const row of stats) {
		if (row.status in result) {
			result[row.status as keyof BookdropStats] = row.count;
		}
	}

	return result;
}

export async function getQueueItem(id: number): Promise<QueueItemWithMetadata | null> {
	const items = await db
		.select()
		.from(bookdropQueue)
		.where(eq(bookdropQueue.id, id))
		.limit(1);

	if (!items[0]) return null;

	return {
		...items[0],
		parsedMetadata: items[0].metadata ? JSON.parse(items[0].metadata) : null
	};
}

// ============================================================================
// File Processing
// ============================================================================

function computeFileHash(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex').substring(0, 32);
}

export async function addToQueue(
	filePath: string,
	originalFilename: string,
	userId?: number,
	source: 'upload' | 'watched_folder' = 'upload'
): Promise<QueueItemWithMetadata> {
	const now = new Date().toISOString();

	// Get file stats
	const fileStat = await stat(filePath);
	const fileBuffer = await readFile(filePath);
	const fileHash = computeFileHash(fileBuffer);

	// Check for duplicates by hash
	const existing = await db
		.select()
		.from(bookdropQueue)
		.where(eq(bookdropQueue.fileHash, fileHash))
		.limit(1);

	if (existing[0] && existing[0].status !== 'failed') {
		throw new Error(`Duplicate file detected: already in queue as "${existing[0].filename}"`);
	}

	// Extract metadata
	let metadata: EbookMetadata | null = null;
	let coverData: string | null = null;

	try {
		const extracted = await extractEbookMetadata(filePath, originalFilename);
		metadata = extracted.metadata;

		// Convert cover to base64 for storage
		if (metadata.coverImage) {
			coverData = `data:${metadata.coverMimeType || 'image/jpeg'};base64,${metadata.coverImage.toString('base64')}`;
			// Don't store the buffer in JSON
			metadata = { ...metadata, coverImage: null };
		}
	} catch (e) {
		console.error('Failed to extract metadata:', e);
	}

	// Insert into queue
	const [item] = await db
		.insert(bookdropQueue)
		.values({
			userId: userId || null,
			filename: originalFilename,
			filePath,
			fileSize: fileStat.size,
			fileHash,
			source,
			status: 'pending',
			metadata: metadata ? JSON.stringify(metadata) : null,
			coverData,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return {
		...item,
		parsedMetadata: metadata
	};
}

export async function updateQueueItemMetadata(
	id: number,
	metadata: Partial<EbookMetadata>
): Promise<void> {
	const item = await getQueueItem(id);
	if (!item) throw new Error('Queue item not found');

	const currentMetadata = item.parsedMetadata || {};
	const updatedMetadata = { ...currentMetadata, ...metadata };

	await db
		.update(bookdropQueue)
		.set({
			metadata: JSON.stringify(updatedMetadata),
			updatedAt: new Date().toISOString()
		})
		.where(eq(bookdropQueue.id, id));
}

// ============================================================================
// Import Actions
// ============================================================================

export async function importQueueItem(
	id: number,
	overrides?: {
		title?: string;
		authorName?: string;
		statusId?: number;
		formatId?: number;
		genreId?: number;
		libraryType?: LibraryType;
	}
): Promise<{ bookId: number }> {
	const item = await getQueueItem(id);
	if (!item) throw new Error('Queue item not found');
	if (item.status === 'imported') throw new Error('Item already imported');

	const now = new Date().toISOString();

	// Mark as processing
	await db
		.update(bookdropQueue)
		.set({ status: 'processing', updatedAt: now })
		.where(eq(bookdropQueue.id, id));

	try {
		const metadata: EbookMetadata = item.parsedMetadata || {} as EbookMetadata;
		const title = overrides?.title || metadata.title || item.filename;
		const authorName = overrides?.authorName || metadata.authors?.[0] || null;

		// Find or create author
		let authorId: number | null = null;
		if (authorName) {
			const existingAuthor = await db
				.select()
				.from(authors)
				.where(eq(authors.name, authorName))
				.limit(1);

			if (existingAuthor[0]) {
				authorId = existingAuthor[0].id;
			} else {
				const [newAuthor] = await db
					.insert(authors)
					.values({ name: authorName, createdAt: now, updatedAt: now })
					.returning();
				authorId = newAuthor.id;
			}
		}

		// Save cover image if available
		let coverImageUrl: string | null = null;
		if (item.coverData && item.coverData.startsWith('data:')) {
			const [header, base64Data] = item.coverData.split(',');
			const mimeMatch = header.match(/data:([^;]+);/);
			const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
			const coverBuffer = Buffer.from(base64Data, 'base64');

			coverImageUrl = await saveCoverImage(coverBuffer, mimeType, {
				title,
				author: authorName || undefined
			});
		}

		// Get format from extension or use override
		let formatId = overrides?.formatId || null;
		if (!formatId) {
			const ext = path.extname(item.filename).toLowerCase().replace('.', '');
			const formatRecord = await db
				.select()
				.from(formats)
				.where(eq(formats.name, ext.toUpperCase()))
				.limit(1);

			if (formatRecord[0]) {
				formatId = formatRecord[0].id;
			}
		}

		// Get default status (Unread) if none provided
		let statusId = overrides?.statusId || null;
		if (!statusId) {
			const unreadStatus = await db
				.select()
				.from(statuses)
				.where(eq(statuses.key, 'UNREAD'))
				.limit(1);

			if (unreadStatus[0]) {
				statusId = unreadStatus[0].id;
			}
		}

		// Save ebook file to permanent storage
		const ebookPath = await saveEbookFile(item.filePath, item.filename, {
			title,
			author: authorName || undefined
		});

		// Get library type from override or default to 'public' for bulk imports
		const libraryType: LibraryType = overrides?.libraryType || 'public';

		// Create book record
		const [book] = await db
			.insert(books)
			.values({
				title,
				authorId,
				statusId,
				genreId: overrides?.genreId || null,
				formatId,
				coverImageUrl,
				ebookPath,
				ebookFormat: path.extname(item.filename).toLowerCase().replace('.', ''),
				summary: metadata.description || null,
				isbn13: metadata.isbn?.length === 13 ? metadata.isbn : null,
				isbn10: metadata.isbn?.length === 10 ? metadata.isbn : null,
				publisher: metadata.publisher || null,
				language: metadata.language || 'English',
				libraryType, // 'personal' or 'public'
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Add book-author junction if author exists
		if (authorId) {
			await db.insert(bookAuthors).values({
				bookId: book.id,
				authorId,
				isPrimary: true,
				createdAt: now,
				updatedAt: now
			});
		}

		// Update queue item as imported
		await db
			.update(bookdropQueue)
			.set({
				status: 'imported',
				bookId: book.id,
				processedAt: now,
				updatedAt: now
			})
			.where(eq(bookdropQueue.id, id));

		// Handle post-import actions based on settings
		const settings = await getSettings(item.userId || undefined);
		if (settings?.afterImport === 'delete') {
			// File already moved by saveEbookFile, temp is cleaned up
		} else if (settings?.afterImport === 'move' && settings.processedFolder) {
			// File already moved to permanent storage
		}

		return { bookId: book.id };
	} catch (error) {
		// Mark as failed
		await db
			.update(bookdropQueue)
			.set({
				status: 'failed',
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				updatedAt: now
			})
			.where(eq(bookdropQueue.id, id));

		throw error;
	}
}

export async function skipQueueItem(id: number): Promise<void> {
	const item = await getQueueItem(id);
	if (!item) throw new Error('Queue item not found');

	const now = new Date().toISOString();
	const settings = await getSettings(item.userId || undefined);

	// Handle skip action
	if (settings?.afterSkip === 'delete') {
		try {
			await unlink(item.filePath);
		} catch {
			// Ignore if file doesn't exist
		}
	} else if (settings?.afterSkip === 'move' && settings.skippedFolder) {
		try {
			const destPath = path.join(settings.skippedFolder, path.basename(item.filePath));
			await mkdir(settings.skippedFolder, { recursive: true });
			await rename(item.filePath, destPath);
		} catch {
			// Ignore move errors
		}
	}

	await db
		.update(bookdropQueue)
		.set({
			status: 'skipped',
			processedAt: now,
			updatedAt: now
		})
		.where(eq(bookdropQueue.id, id));
}

export async function deleteQueueItem(id: number, deleteFile = true): Promise<void> {
	const item = await getQueueItem(id);
	if (!item) throw new Error('Queue item not found');

	// Delete file if requested and it exists
	if (deleteFile && item.filePath && existsSync(item.filePath)) {
		try {
			await unlink(item.filePath);
		} catch {
			// Ignore deletion errors
		}
	}

	// Remove from queue
	await db.delete(bookdropQueue).where(eq(bookdropQueue.id, id));
}

export async function retryQueueItem(id: number): Promise<void> {
	const now = new Date().toISOString();

	await db
		.update(bookdropQueue)
		.set({
			status: 'pending',
			errorMessage: null,
			processedAt: null,
			updatedAt: now
		})
		.where(eq(bookdropQueue.id, id));
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function importAllPending(
	userId?: number,
	options?: { libraryType?: LibraryType }
): Promise<{ success: number; failed: number }> {
	const items = await getQueueItems(userId, 'pending');
	let success = 0;
	let failed = 0;

	for (const item of items) {
		try {
			await importQueueItem(item.id, { libraryType: options?.libraryType || 'public' });
			success++;
		} catch {
			failed++;
		}
	}

	return { success, failed };
}

export async function clearQueue(
	userId?: number,
	status?: 'imported' | 'skipped' | 'failed'
): Promise<number> {
	const conditions = [];
	if (userId) conditions.push(eq(bookdropQueue.userId, userId));
	if (status) conditions.push(eq(bookdropQueue.status, status));

	if (conditions.length === 0) {
		const result = await db.delete(bookdropQueue);
		return result.changes;
	}

	const result = await db.delete(bookdropQueue).where(and(...conditions));
	return result.changes;
}
