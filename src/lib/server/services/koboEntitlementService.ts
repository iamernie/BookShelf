/**
 * Kobo Entitlement Service
 *
 * Generates Kobo-compatible book metadata and entitlements for device sync.
 * Follows the Kobo API format for book representation.
 */

import { db } from '$lib/server/db';
import { books, authors, bookAuthors, series, bookSeries, genres } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getOrCreateSyncState } from './koboService';
import { statSync, existsSync } from 'fs';
import path from 'path';

const EBOOKS_PATH = process.env.EBOOKS_PATH || './data/ebooks';

// ============================================
// Types
// ============================================

export interface KoboBookMetadata {
	ContributorRoles: { Name: string }[];
	Contributors: string;
	CoverImageId: string;
	CrossRevisionId: string;
	CurrentDisplayPrice: { CurrencyCode: string; TotalAmount: number };
	Description: string;
	DownloadUrls: { Format: string; Size: number; Url: string; Platform?: string }[];
	EntitlementId: string;
	ExternalIds: unknown[];
	Genre: string;
	IsEligibleForKoboLove: boolean;
	IsInternetArchive: boolean;
	IsPreOrder: boolean;
	IsSocialEnabled: boolean;
	Language: string;
	PhoneticPronunciations: Record<string, unknown>;
	PublicationDate: string;
	Publisher: { Imprint: string; Name: string };
	RevisionId: string;
	Series?: { Name: string; Number: number; NumberFloat: number; Id?: string };
	Slug: string;
	Subtitle: string;
	Title: string;
	WorkId: string;
}

export interface KoboReadingState {
	EntitlementId: string;
	Created: string;
	LastModified: string;
	PriorityTimestamp: string;
	CurrentBookmark: {
		ProgressPercent: number;
		Location?: {
			Value: string;
			Type: string;
			Source: string;
		};
		LastModified: string;
	};
	StatusInfo: {
		Status: string;
		LastModified: string;
	};
	Statistics?: {
		SpentReadingMinutes: number;
		LastModified: string;
	};
}

export interface BookEntitlement {
	Accessibility: string;
	ActivePeriod: { From: string };
	Created: string;
	CrossRevisionId: string;
	Id: string;
	IsRemoved: boolean;
	IsHiddenFromArchive: boolean;
	IsLocked: boolean;
	LastModified: string;
	OriginCategory: string;
	RevisionId: string;
	Status: string;
}

export interface NewEntitlement {
	NewEntitlement: {
		BookEntitlement: BookEntitlement;
		BookMetadata: KoboBookMetadata;
		ReadingState: KoboReadingState;
	};
}

export interface ChangedEntitlement {
	ChangedEntitlement: {
		BookEntitlement: BookEntitlement;
		BookMetadata?: KoboBookMetadata;
		ReadingState?: KoboReadingState;
	};
}

export interface ChangedReadingState {
	ChangedReadingState: KoboReadingState;
}

export type Entitlement = NewEntitlement | ChangedEntitlement | ChangedReadingState;

// ============================================
// Helper Functions
// ============================================

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function formatIsoDate(date: string | null | undefined): string {
	if (!date) {
		return new Date().toISOString();
	}
	try {
		return new Date(date).toISOString();
	} catch {
		return new Date().toISOString();
	}
}

// ============================================
// Book Data Fetching
// ============================================

interface BookWithRelations {
	id: number;
	title: string;
	summary: string | null;
	isbn13: string | null;
	language: string | null;
	publisher: string | null;
	releaseDate: string | null;
	ebookPath: string | null;
	ebookFormat: string | null;
	coverImageUrl: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	authors: { name: string; role: string | null }[];
	series: { title: string; bookNum: number | null }[];
	genreName: string | null;
}

async function getBookWithRelations(bookId: number): Promise<BookWithRelations | null> {
	// Get book with its genre
	const [book] = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			isbn13: books.isbn13,
			language: books.language,
			publisher: books.publisher,
			releaseDate: books.releaseDate,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			coverImageUrl: books.coverImageUrl,
			createdAt: books.createdAt,
			updatedAt: books.updatedAt,
			genreId: books.genreId
		})
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (!book) {
		return null;
	}

	// Get genre name
	let genreName: string | null = null;
	if (book.genreId) {
		const [genre] = await db
			.select({ name: genres.name })
			.from(genres)
			.where(eq(genres.id, book.genreId))
			.limit(1);
		genreName = genre?.name || null;
	}

	// Get authors
	const bookAuthorRows = await db
		.select({
			name: authors.name,
			role: bookAuthors.role
		})
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, bookId))
		.orderBy(bookAuthors.displayOrder);

	// Get series
	const bookSeriesRows = await db
		.select({
			title: series.title,
			bookNum: bookSeries.bookNum
		})
		.from(bookSeries)
		.innerJoin(series, eq(bookSeries.seriesId, series.id))
		.where(eq(bookSeries.bookId, bookId))
		.orderBy(bookSeries.displayOrder);

	return {
		id: book.id,
		title: book.title,
		summary: book.summary,
		isbn13: book.isbn13,
		language: book.language,
		publisher: book.publisher,
		releaseDate: book.releaseDate,
		ebookPath: book.ebookPath,
		ebookFormat: book.ebookFormat,
		coverImageUrl: book.coverImageUrl,
		createdAt: book.createdAt,
		updatedAt: book.updatedAt,
		authors: bookAuthorRows,
		series: bookSeriesRows,
		genreName
	};
}

// ============================================
// Metadata Generation
// ============================================

/**
 * Generate Kobo-compatible metadata for a book
 */
export async function generateBookMetadata(
	userId: number,
	bookId: number,
	baseUrl: string,
	token: string
): Promise<KoboBookMetadata | null> {
	const book = await getBookWithRelations(bookId);
	if (!book) {
		return null;
	}

	const { entitlementId } = await getOrCreateSyncState(userId, bookId);

	// Get file size if ebook exists
	let fileSize = 0;
	if (book.ebookPath) {
		try {
			const fullPath = path.join(EBOOKS_PATH, book.ebookPath);
			if (existsSync(fullPath)) {
				const stats = statSync(fullPath);
				fileSize = stats.size;
			}
		} catch {
			// File may not exist
		}
	}

	// Build author string
	const authorNames = book.authors.map((a) => a.name);
	const contributors = authorNames.join(', ') || 'Unknown Author';

	// Build series info
	let seriesInfo: KoboBookMetadata['Series'] | undefined;
	if (book.series.length > 0) {
		const primarySeries = book.series[0];
		seriesInfo = {
			Name: primarySeries.title,
			Number: primarySeries.bookNum || 1,
			NumberFloat: primarySeries.bookNum || 1
		};
	}

	// Build download URL
	const downloadUrl = `${baseUrl}/api/kobo/${token}/v1/books/${bookId}/download`;

	// Determine format (EPUB or KEPUB)
	const format = book.ebookFormat?.toUpperCase() === 'KEPUB' ? 'KEPUB' : 'EPUB';

	return {
		ContributorRoles: authorNames.map((name) => ({ Name: name })),
		Contributors: contributors,
		CoverImageId: String(bookId),
		CrossRevisionId: entitlementId,
		CurrentDisplayPrice: { CurrencyCode: 'USD', TotalAmount: 0 },
		Description: book.summary || '',
		DownloadUrls: book.ebookPath
			? [
					{
						Format: format,
						Size: fileSize,
						Url: downloadUrl,
						Platform: 'Generic'
					}
				]
			: [],
		EntitlementId: entitlementId,
		ExternalIds: [],
		Genre: book.genreName || 'General',
		IsEligibleForKoboLove: false,
		IsInternetArchive: false,
		IsPreOrder: false,
		IsSocialEnabled: true,
		Language: book.language || 'en',
		PhoneticPronunciations: {},
		PublicationDate: book.releaseDate || new Date().toISOString().split('T')[0],
		Publisher: {
			Imprint: '',
			Name: book.publisher || ''
		},
		RevisionId: entitlementId,
		Series: seriesInfo,
		Slug: slugify(book.title),
		Subtitle: '',
		Title: book.title,
		WorkId: entitlementId
	};
}

/**
 * Generate an empty reading state for a book
 */
export function generateEmptyReadingState(entitlementId: string): KoboReadingState {
	const now = new Date().toISOString();

	return {
		EntitlementId: entitlementId,
		Created: now,
		LastModified: now,
		PriorityTimestamp: now,
		CurrentBookmark: {
			ProgressPercent: 0,
			LastModified: now
		},
		StatusInfo: {
			Status: 'ReadyToRead',
			LastModified: now
		}
	};
}

/**
 * Generate a book entitlement structure
 */
export function generateBookEntitlement(
	entitlementId: string,
	isRemoved: boolean = false
): BookEntitlement {
	const now = new Date().toISOString();

	return {
		Accessibility: 'Full',
		ActivePeriod: { From: now },
		Created: now,
		CrossRevisionId: entitlementId,
		Id: entitlementId,
		IsRemoved: isRemoved,
		IsHiddenFromArchive: false,
		IsLocked: false,
		LastModified: now,
		OriginCategory: 'Imported',
		RevisionId: entitlementId,
		Status: isRemoved ? 'Revoked' : 'Active'
	};
}

// ============================================
// Entitlement Generation
// ============================================

/**
 * Generate a NewEntitlement for a book (used when adding books to device)
 */
export async function generateNewEntitlement(
	userId: number,
	bookId: number,
	baseUrl: string,
	token: string
): Promise<NewEntitlement | null> {
	const metadata = await generateBookMetadata(userId, bookId, baseUrl, token);
	if (!metadata) {
		return null;
	}

	const { entitlementId } = await getOrCreateSyncState(userId, bookId);

	return {
		NewEntitlement: {
			BookEntitlement: generateBookEntitlement(entitlementId, false),
			BookMetadata: metadata,
			ReadingState: generateEmptyReadingState(entitlementId)
		}
	};
}

/**
 * Generate a ChangedEntitlement for a book (used when removing books from device)
 */
export async function generateChangedEntitlement(
	userId: number,
	bookId: number,
	baseUrl: string,
	token: string,
	removed: boolean = false
): Promise<ChangedEntitlement | null> {
	const { entitlementId } = await getOrCreateSyncState(userId, bookId);

	if (removed) {
		// For removed books, only send minimal entitlement info
		return {
			ChangedEntitlement: {
				BookEntitlement: generateBookEntitlement(entitlementId, true)
			}
		};
	}

	// For changed books, include full metadata
	const metadata = await generateBookMetadata(userId, bookId, baseUrl, token);
	if (!metadata) {
		return null;
	}

	return {
		ChangedEntitlement: {
			BookEntitlement: generateBookEntitlement(entitlementId, false),
			BookMetadata: metadata,
			ReadingState: generateEmptyReadingState(entitlementId)
		}
	};
}

/**
 * Generate entitlements for multiple books
 */
export async function generateEntitlements(
	userId: number,
	bookIds: number[],
	baseUrl: string,
	token: string,
	type: 'new' | 'removed'
): Promise<Entitlement[]> {
	const entitlements: Entitlement[] = [];

	for (const bookId of bookIds) {
		if (type === 'new') {
			const entitlement = await generateNewEntitlement(userId, bookId, baseUrl, token);
			if (entitlement) {
				entitlements.push(entitlement);
			}
		} else {
			const entitlement = await generateChangedEntitlement(userId, bookId, baseUrl, token, true);
			if (entitlement) {
				entitlements.push(entitlement);
			}
		}
	}

	return entitlements;
}
