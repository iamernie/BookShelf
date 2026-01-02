/**
 * Diagnostic Service
 * System health checks, database diagnostics, and repair tools
 */

import { db } from '$lib/server/db';
import {
	books,
	authors,
	series,
	genres,
	statuses,
	formats,
	users,
	sessions,
	bookAuthors,
	bookSeries,
	tags,
	bookTags,
	settings,
	userBooks,
	mediaSources,
	bookMediaSources
} from '$lib/server/db/schema';
import { count, eq, isNull, sql, notInArray, inArray, ne, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

export interface LibraryStats {
	totalBooks: number;
	totalAuthors: number;
	totalSeries: number;
	booksWithEbooks: number;
}

export interface UserLibraryStats {
	userId: number;
	username: string;
	email: string;
	bookCount: number;
}

export interface SystemHealth {
	status: 'healthy' | 'warning' | 'error';
	database: {
		connected: boolean;
		size: string;
		path: string;
	};
	storage: {
		coversPath: string;
		coversSize: string;
		coversCount: number;
		ebooksPath: string;
		ebooksSize: string;
		ebooksCount: number;
	};
	counts: {
		books: number;
		authors: number;
		series: number;
		genres: number;
		users: number;
		sessions: number;
		mediaSources: number;
		systemMediaSources: number;
		userMediaSources: number;
	};
	// New library statistics
	libraryStats: {
		total: LibraryStats;
		publicLibrary: LibraryStats;
		userLibraries: UserLibraryStats[];
	};
	issues: DiagnosticIssue[];
}

export interface DiagnosticIssue {
	type: 'orphan' | 'missing' | 'duplicate' | 'integrity';
	severity: 'info' | 'warning' | 'error';
	entity: string;
	count: number;
	description: string;
	canRepair: boolean;
}

export interface RepairResult {
	success: boolean;
	repaired: number;
	errors: string[];
}

/**
 * Get folder size in human readable format
 */
function getFolderSize(folderPath: string): { size: string; count: number } {
	try {
		if (!fs.existsSync(folderPath)) {
			return { size: '0 B', count: 0 };
		}

		let totalSize = 0;
		let fileCount = 0;

		const files = fs.readdirSync(folderPath);
		for (const file of files) {
			const filePath = path.join(folderPath, file);
			const stats = fs.statSync(filePath);
			if (stats.isFile()) {
				totalSize += stats.size;
				fileCount++;
			}
		}

		// Format size
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = totalSize;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return {
			size: `${size.toFixed(1)} ${units[unitIndex]}`,
			count: fileCount
		};
	} catch {
		return { size: 'Unknown', count: 0 };
	}
}

/**
 * Get database file size
 */
function getDatabaseSize(dbPath: string): string {
	try {
		if (!fs.existsSync(dbPath)) {
			return 'Unknown';
		}
		const stats = fs.statSync(dbPath);
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = stats.size;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		return `${size.toFixed(1)} ${units[unitIndex]}`;
	} catch {
		return 'Unknown';
	}
}

/**
 * Run all diagnostic checks
 */
export async function runDiagnostics(): Promise<SystemHealth> {
	const issues: DiagnosticIssue[] = [];
	let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

	// Get database path from env or default
	const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';
	const coversPath = process.env.COVERS_PATH || './static/covers';
	const ebooksPath = process.env.EBOOKS_PATH || './static/ebooks';

	// Get counts
	const [bookCount] = await db.select({ count: count() }).from(books);
	const [authorCount] = await db.select({ count: count() }).from(authors);
	const [seriesCount] = await db.select({ count: count() }).from(series);
	const [genreCount] = await db.select({ count: count() }).from(genres);
	const [userCount] = await db.select({ count: count() }).from(users);
	const [sessionCount] = await db.select({ count: count() }).from(sessions);
	const [mediaSourceCount] = await db.select({ count: count() }).from(mediaSources);
	const [systemMediaSourceCount] = await db.select({ count: count() }).from(mediaSources).where(eq(mediaSources.isSystem, true));
	const [userMediaSourceCount] = await db.select({ count: count() }).from(mediaSources).where(sql`${mediaSources.userId} IS NOT NULL`);

	// Get storage info
	const coversInfo = getFolderSize(coversPath);
	const ebooksInfo = getFolderSize(ebooksPath);

	// Check for orphaned book-author relationships
	const orphanedBookAuthors = await db
		.select({ count: count() })
		.from(bookAuthors)
		.where(
			sql`${bookAuthors.bookId} NOT IN (SELECT id FROM books) OR ${bookAuthors.authorId} NOT IN (SELECT id FROM authors)`
		);

	if (orphanedBookAuthors[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'warning',
			entity: 'bookauthors',
			count: orphanedBookAuthors[0].count,
			description: 'Book-author relationships referencing deleted books or authors',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for orphaned book-series relationships
	const orphanedBookSeries = await db
		.select({ count: count() })
		.from(bookSeries)
		.where(
			sql`${bookSeries.bookId} NOT IN (SELECT id FROM books) OR ${bookSeries.seriesId} NOT IN (SELECT id FROM series)`
		);

	if (orphanedBookSeries[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'warning',
			entity: 'bookseries',
			count: orphanedBookSeries[0].count,
			description: 'Book-series relationships referencing deleted books or series',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for orphaned book-tags relationships
	const orphanedBookTags = await db
		.select({ count: count() })
		.from(bookTags)
		.where(
			sql`${bookTags.bookId} NOT IN (SELECT id FROM books) OR ${bookTags.tagId} NOT IN (SELECT id FROM tags)`
		);

	if (orphanedBookTags[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'warning',
			entity: 'booktags',
			count: orphanedBookTags[0].count,
			description: 'Book-tag relationships referencing deleted books or tags',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for orphaned book-media source relationships
	const orphanedBookMediaSources = await db
		.select({ count: count() })
		.from(bookMediaSources)
		.where(
			sql`${bookMediaSources.bookId} NOT IN (SELECT id FROM books) OR ${bookMediaSources.mediaSourceId} NOT IN (SELECT id FROM media_sources)`
		);

	if (orphanedBookMediaSources[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'warning',
			entity: 'bookmediasources',
			count: orphanedBookMediaSources[0].count,
			description: 'Book-media source relationships referencing deleted books or sources',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for media sources with no books (excluding system sources)
	const unusedUserMediaSources = await db
		.select({ count: count() })
		.from(mediaSources)
		.where(
			sql`${mediaSources.userId} IS NOT NULL
			AND ${mediaSources.id} NOT IN (SELECT DISTINCT mediaSourceId FROM book_media_sources)`
		);

	if (unusedUserMediaSources[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'info',
			entity: 'mediasources',
			count: unusedUserMediaSources[0].count,
			description: 'User-created media sources not used by any books',
			canRepair: true
		});
	}

	// Check for authors with no books
	const authorsWithNoBooks = await db
		.select({ count: count() })
		.from(authors)
		.where(
			sql`${authors.id} NOT IN (SELECT DISTINCT authorId FROM bookauthors WHERE authorId IS NOT NULL)
			AND ${authors.id} NOT IN (SELECT DISTINCT authorId FROM books WHERE authorId IS NOT NULL)`
		);

	if (authorsWithNoBooks[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'info',
			entity: 'authors',
			count: authorsWithNoBooks[0].count,
			description: 'Authors not linked to any books',
			canRepair: true
		});
	}

	// Check for series with no books
	const seriesWithNoBooks = await db
		.select({ count: count() })
		.from(series)
		.where(
			sql`${series.id} NOT IN (SELECT DISTINCT seriesId FROM bookseries WHERE seriesId IS NOT NULL)
			AND ${series.id} NOT IN (SELECT DISTINCT seriesId FROM books WHERE seriesId IS NOT NULL)`
		);

	if (seriesWithNoBooks[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'info',
			entity: 'series',
			count: seriesWithNoBooks[0].count,
			description: 'Series not linked to any books',
			canRepair: true
		});
	}

	// Check for tags with no books
	const tagsWithNoBooks = await db
		.select({ count: count() })
		.from(tags)
		.where(sql`${tags.id} NOT IN (SELECT DISTINCT tagId FROM booktags WHERE tagId IS NOT NULL)`);

	if (tagsWithNoBooks[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'info',
			entity: 'tags',
			count: tagsWithNoBooks[0].count,
			description: 'Tags not used by any books',
			canRepair: true
		});
	}

	// Check for books with invalid genre references
	const booksWithInvalidGenre = await db
		.select({ count: count() })
		.from(books)
		.where(
			sql`${books.genreId} IS NOT NULL AND ${books.genreId} NOT IN (SELECT id FROM genres)`
		);

	if (booksWithInvalidGenre[0].count > 0) {
		issues.push({
			type: 'integrity',
			severity: 'warning',
			entity: 'books',
			count: booksWithInvalidGenre[0].count,
			description: 'Books referencing non-existent genres',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for books with invalid status references
	const booksWithInvalidStatus = await db
		.select({ count: count() })
		.from(books)
		.where(
			sql`${books.statusId} IS NOT NULL AND ${books.statusId} NOT IN (SELECT id FROM statuses)`
		);

	if (booksWithInvalidStatus[0].count > 0) {
		issues.push({
			type: 'integrity',
			severity: 'warning',
			entity: 'books',
			count: booksWithInvalidStatus[0].count,
			description: 'Books referencing non-existent statuses',
			canRepair: true
		});
		overallStatus = 'warning';
	}

	// Check for expired sessions
	const expiredSessions = await db
		.select({ count: count() })
		.from(sessions)
		.where(sql`${sessions.expires} < datetime('now')`);

	if (expiredSessions[0].count > 0) {
		issues.push({
			type: 'orphan',
			severity: 'info',
			entity: 'sessions',
			count: expiredSessions[0].count,
			description: 'Expired user sessions that can be cleaned up',
			canRepair: true
		});
	}

	// ========== Library Statistics ==========

	// Total books with ebooks attached
	const [totalBooksWithEbooks] = await db
		.select({ count: count() })
		.from(books)
		.where(sql`${books.ebookPath} IS NOT NULL AND ${books.ebookPath} != ''`);

	// Total unique authors (linked to books)
	const [totalLinkedAuthors] = await db
		.select({ count: sql<number>`COUNT(DISTINCT ${bookAuthors.authorId})` })
		.from(bookAuthors);

	// Total unique series (linked to books)
	const [totalLinkedSeries] = await db
		.select({ count: sql<number>`COUNT(DISTINCT ${bookSeries.seriesId})` })
		.from(bookSeries);

	// Public library stats
	const [publicBookCount] = await db
		.select({ count: count() })
		.from(books)
		.where(eq(books.libraryType, 'public'));

	const [publicBooksWithEbooks] = await db
		.select({ count: count() })
		.from(books)
		.where(and(
			eq(books.libraryType, 'public'),
			sql`${books.ebookPath} IS NOT NULL AND ${books.ebookPath} != ''`
		));

	// Public library authors (authors linked to public books)
	const [publicAuthors] = await db
		.select({ count: sql<number>`COUNT(DISTINCT ${bookAuthors.authorId})` })
		.from(bookAuthors)
		.innerJoin(books, eq(bookAuthors.bookId, books.id))
		.where(eq(books.libraryType, 'public'));

	// Public library series (series linked to public books)
	const [publicSeries] = await db
		.select({ count: sql<number>`COUNT(DISTINCT ${bookSeries.seriesId})` })
		.from(bookSeries)
		.innerJoin(books, eq(bookSeries.bookId, books.id))
		.where(eq(books.libraryType, 'public'));

	// Per-user library stats
	const userLibraryStats = await db
		.select({
			userId: users.id,
			username: users.username,
			email: users.email,
			bookCount: count(userBooks.id)
		})
		.from(users)
		.leftJoin(userBooks, eq(users.id, userBooks.userId))
		.groupBy(users.id)
		.orderBy(sql`count(${userBooks.id}) DESC`);

	return {
		status: overallStatus,
		database: {
			connected: true,
			size: getDatabaseSize(dbPath),
			path: dbPath
		},
		storage: {
			coversPath,
			coversSize: coversInfo.size,
			coversCount: coversInfo.count,
			ebooksPath,
			ebooksSize: ebooksInfo.size,
			ebooksCount: ebooksInfo.count
		},
		counts: {
			books: bookCount.count,
			authors: authorCount.count,
			series: seriesCount.count,
			genres: genreCount.count,
			users: userCount.count,
			sessions: sessionCount.count,
			mediaSources: mediaSourceCount.count,
			systemMediaSources: systemMediaSourceCount.count,
			userMediaSources: userMediaSourceCount.count
		},
		libraryStats: {
			total: {
				totalBooks: bookCount.count,
				totalAuthors: totalLinkedAuthors.count || 0,
				totalSeries: totalLinkedSeries.count || 0,
				booksWithEbooks: totalBooksWithEbooks.count
			},
			publicLibrary: {
				totalBooks: publicBookCount.count,
				totalAuthors: publicAuthors.count || 0,
				totalSeries: publicSeries.count || 0,
				booksWithEbooks: publicBooksWithEbooks.count
			},
			userLibraries: userLibraryStats.map(u => ({
				userId: u.userId,
				username: u.username || 'Unknown',
				email: u.email,
				bookCount: u.bookCount
			}))
		},
		issues
	};
}

/**
 * Repair orphaned relationships
 */
export async function repairOrphanedRelationships(): Promise<RepairResult> {
	const errors: string[] = [];
	let repaired = 0;

	try {
		// Clean orphaned bookauthors
		const baResult = await db.run(sql`
			DELETE FROM bookauthors
			WHERE bookId NOT IN (SELECT id FROM books)
			   OR authorId NOT IN (SELECT id FROM authors)
		`);
		repaired += baResult.changes;

		// Clean orphaned bookseries
		const bsResult = await db.run(sql`
			DELETE FROM bookseries
			WHERE bookId NOT IN (SELECT id FROM books)
			   OR seriesId NOT IN (SELECT id FROM series)
		`);
		repaired += bsResult.changes;

		// Clean orphaned booktags
		const btResult = await db.run(sql`
			DELETE FROM booktags
			WHERE bookId NOT IN (SELECT id FROM books)
			   OR tagId NOT IN (SELECT id FROM tags)
		`);
		repaired += btResult.changes;

		// Clean orphaned book_media_sources
		const bmsResult = await db.run(sql`
			DELETE FROM book_media_sources
			WHERE bookId NOT IN (SELECT id FROM books)
			   OR mediaSourceId NOT IN (SELECT id FROM media_sources)
		`);
		repaired += bmsResult.changes;

		return { success: true, repaired, errors };
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Unknown error');
		return { success: false, repaired, errors };
	}
}

/**
 * Clean expired sessions
 */
export async function cleanExpiredSessions(): Promise<RepairResult> {
	try {
		const result = await db.run(sql`DELETE FROM sessions WHERE expires < datetime('now')`);
		return { success: true, repaired: result.changes, errors: [] };
	} catch (error) {
		return {
			success: false,
			repaired: 0,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

/**
 * Fix invalid foreign key references in books
 */
export async function fixInvalidBookReferences(): Promise<RepairResult> {
	const errors: string[] = [];
	let repaired = 0;

	try {
		// Clear invalid genre references
		const genreResult = await db.run(sql`
			UPDATE books SET genreId = NULL
			WHERE genreId IS NOT NULL AND genreId NOT IN (SELECT id FROM genres)
		`);
		repaired += genreResult.changes;

		// Clear invalid status references
		const statusResult = await db.run(sql`
			UPDATE books SET statusId = NULL
			WHERE statusId IS NOT NULL AND statusId NOT IN (SELECT id FROM statuses)
		`);
		repaired += statusResult.changes;

		// Clear invalid format references
		const formatResult = await db.run(sql`
			UPDATE books SET formatId = NULL
			WHERE formatId IS NOT NULL AND formatId NOT IN (SELECT id FROM formats)
		`);
		repaired += formatResult.changes;

		// Clear invalid author references (legacy single-author field)
		const authorResult = await db.run(sql`
			UPDATE books SET authorId = NULL
			WHERE authorId IS NOT NULL AND authorId NOT IN (SELECT id FROM authors)
		`);
		repaired += authorResult.changes;

		// Clear invalid series references (legacy single-series field)
		const seriesResult = await db.run(sql`
			UPDATE books SET seriesId = NULL
			WHERE seriesId IS NOT NULL AND seriesId NOT IN (SELECT id FROM series)
		`);
		repaired += seriesResult.changes;

		return { success: true, repaired, errors };
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Unknown error');
		return { success: false, repaired, errors };
	}
}

/**
 * Remove orphaned authors (no books)
 */
export async function removeOrphanedAuthors(): Promise<RepairResult> {
	try {
		const result = await db.run(sql`
			DELETE FROM authors
			WHERE id NOT IN (SELECT DISTINCT authorId FROM bookauthors WHERE authorId IS NOT NULL)
			  AND id NOT IN (SELECT DISTINCT authorId FROM books WHERE authorId IS NOT NULL)
		`);
		return { success: true, repaired: result.changes, errors: [] };
	} catch (error) {
		return {
			success: false,
			repaired: 0,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

/**
 * Remove orphaned series (no books)
 */
export async function removeOrphanedSeries(): Promise<RepairResult> {
	try {
		const result = await db.run(sql`
			DELETE FROM series
			WHERE id NOT IN (SELECT DISTINCT seriesId FROM bookseries WHERE seriesId IS NOT NULL)
			  AND id NOT IN (SELECT DISTINCT seriesId FROM books WHERE seriesId IS NOT NULL)
		`);
		return { success: true, repaired: result.changes, errors: [] };
	} catch (error) {
		return {
			success: false,
			repaired: 0,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

/**
 * Remove orphaned tags (no books)
 */
export async function removeOrphanedTags(): Promise<RepairResult> {
	try {
		const result = await db.run(sql`
			DELETE FROM tags
			WHERE id NOT IN (SELECT DISTINCT tagId FROM booktags WHERE tagId IS NOT NULL)
		`);
		return { success: true, repaired: result.changes, errors: [] };
	} catch (error) {
		return {
			success: false,
			repaired: 0,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

/**
 * Remove unused user-created media sources (not used by any books)
 */
export async function removeUnusedMediaSources(): Promise<RepairResult> {
	try {
		const result = await db.run(sql`
			DELETE FROM media_sources
			WHERE userId IS NOT NULL
			  AND id NOT IN (SELECT DISTINCT mediaSourceId FROM book_media_sources)
		`);
		return { success: true, repaired: result.changes, errors: [] };
	} catch (error) {
		return {
			success: false,
			repaired: 0,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

/**
 * Run all repairs
 */
export async function runAllRepairs(): Promise<{ results: Record<string, RepairResult>; totalRepaired: number }> {
	const results: Record<string, RepairResult> = {};
	let totalRepaired = 0;

	results.orphanedRelationships = await repairOrphanedRelationships();
	totalRepaired += results.orphanedRelationships.repaired;

	results.invalidBookReferences = await fixInvalidBookReferences();
	totalRepaired += results.invalidBookReferences.repaired;

	results.expiredSessions = await cleanExpiredSessions();
	totalRepaired += results.expiredSessions.repaired;

	return { results, totalRepaired };
}
