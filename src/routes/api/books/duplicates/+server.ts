/**
 * API: /api/books/duplicates
 * Find potential duplicate books based on title and author
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books, bookAuthors, authors } from '$lib/server/db/schema';
import { eq, sql, or, like } from 'drizzle-orm';
import { calculateSimilarity, normalizeString, normalizeAuthorName } from '$lib/server/services/importService';

interface DuplicateMatch {
	id: number;
	title: string;
	author: string | null;
	coverImageUrl: string | null;
	isbn13: string | null;
	similarity: number;
	matchType: 'exact_isbn' | 'exact_title' | 'fuzzy';
}

// GET /api/books/duplicates?title=...&author=...&isbn13=...
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const title = url.searchParams.get('title')?.trim();
	const author = url.searchParams.get('author')?.trim();
	const isbn13 = url.searchParams.get('isbn13')?.trim();

	if (!title && !isbn13) {
		return json({ matches: [] });
	}

	const matches: DuplicateMatch[] = [];

	try {
		// First check for exact ISBN match
		if (isbn13) {
			const isbnMatch = await db.query.books.findFirst({
				where: eq(books.isbn13, isbn13),
				with: {
					bookAuthors: {
						with: {
							author: true
						}
					}
				}
			});

			if (isbnMatch) {
				const authorName = isbnMatch.bookAuthors[0]?.author?.name || null;
				matches.push({
					id: isbnMatch.id,
					title: isbnMatch.title,
					author: authorName,
					coverImageUrl: isbnMatch.coverImageUrl,
					isbn13: isbnMatch.isbn13,
					similarity: 100,
					matchType: 'exact_isbn'
				});
				// ISBN match is definitive, return immediately
				return json({ matches });
			}
		}

		// Search for potential duplicates by title
		if (title) {
			const normalizedSearchTitle = normalizeString(title);
			const normalizedSearchAuthor = author ? normalizeAuthorName(author) : '';

			// Get books with similar titles using LIKE for initial filtering
			// This reduces the dataset before doing expensive fuzzy matching
			// Strip punctuation from search terms (e.g., "World:" -> "World")
			const searchTerms = title
				.split(' ')
				.map(t => t.replace(/[^\w]/g, '')) // Remove non-word characters
				.filter(t => t.length > 2)
				.slice(0, 3);

			let candidateBooks;
			if (searchTerms.length > 0) {
				// Search for books containing any of the significant words
				candidateBooks = await db.query.books.findMany({
					where: or(
						...searchTerms.map(term => like(books.title, `%${term}%`))
					),
					with: {
						bookAuthors: {
							with: {
								author: true
							}
						}
					},
					limit: 100
				});
			} else {
				// Fallback: search by exact title start
				candidateBooks = await db.query.books.findMany({
					where: like(books.title, `${title.substring(0, 10)}%`),
					with: {
						bookAuthors: {
							with: {
								author: true
							}
						}
					},
					limit: 50
				});
			}

			// Score each candidate
			for (const book of candidateBooks) {
				const bookTitle = normalizeString(book.title);
				const bookAuthor = book.bookAuthors[0]?.author?.name || '';
				const normalizedBookAuthor = normalizeAuthorName(bookAuthor);

				// Calculate multiple similarity scores
				let titleSimilarity = calculateSimilarity(normalizedSearchTitle, bookTitle);

				// Check if either title contains the other (handles "Edge World" vs "Edge World: Undying Mercenaries")
				// This is important for detecting duplicates when audiobook files have expanded titles
				const searchLower = normalizedSearchTitle.toLowerCase();
				const bookLower = bookTitle.toLowerCase();

				// If book title is a prefix of search title, boost the score
				if (searchLower.startsWith(bookLower + ':') || searchLower.startsWith(bookLower + ' -') || searchLower.startsWith(bookLower + ',')) {
					// The existing book title is clearly the base title
					titleSimilarity = Math.max(titleSimilarity, 0.85);
				} else if (bookLower.startsWith(searchLower)) {
					// Search title is a prefix of book title
					titleSimilarity = Math.max(titleSimilarity, 0.80);
				} else if (searchLower.includes(bookLower) && bookTitle.length >= 5) {
					// Book title is contained within search title
					titleSimilarity = Math.max(titleSimilarity, 0.75);
				}

				// If we have an author to match, factor it in
				let combinedScore = titleSimilarity;
				if (normalizedSearchAuthor && normalizedBookAuthor) {
					const authorSimilarity = calculateSimilarity(normalizedSearchAuthor, normalizedBookAuthor);
					// Weight: 60% title, 40% author when author is provided
					combinedScore = (titleSimilarity * 0.6) + (authorSimilarity * 0.4);
				}

				// Only include if similarity is above threshold
				if (combinedScore >= 0.6) {
					const matchType = titleSimilarity === 1 ? 'exact_title' : 'fuzzy';
					matches.push({
						id: book.id,
						title: book.title,
						author: bookAuthor || null,
						coverImageUrl: book.coverImageUrl,
						isbn13: book.isbn13,
						similarity: Math.round(combinedScore * 100),
						matchType
					});
				}
			}

			// Sort by similarity descending
			matches.sort((a, b) => b.similarity - a.similarity);

			// Limit to top 10 matches
			matches.splice(10);
		}

		return json({ matches });

	} catch (err) {
		console.error('[api/books/duplicates] Error finding duplicates:', err);
		throw error(500, 'Failed to search for duplicates');
	}
};
