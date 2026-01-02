/**
 * Recommendation Service
 * AI-powered and rule-based book recommendations
 */

import { db } from '$lib/server/db';
import { books, authors, series, genres, bookAuthors, bookSeries, settings } from '$lib/server/db/schema';
import { eq, ne, desc, sql, and, isNull, isNotNull, notInArray, inArray, gt } from 'drizzle-orm';
import { createLogger } from './loggerService';

const log = createLogger('recommendations');

// Status constants (matching database IDs)
const STATUS_UNREAD = 1;
const STATUS_READ = 2;
const STATUS_CURRENT = 3;
const STATUS_WISHLIST = 8;

export interface AIRecommendation {
	title: string;
	author: string;
	reason: string;
	inLibrary?: boolean;
	bookId?: number;
}

export interface RuleBasedRecommendation {
	type: 'series' | 'author' | 'genre';
	title: string;
	subtitle?: string;
	books: {
		id: number;
		title: string;
		coverImageUrl: string | null;
		authorName: string | null;
		seriesTitle?: string | null;
		bookNum?: number | null;
	}[];
}

/**
 * Get AI recommendation settings
 */
export async function getAISettings(): Promise<{
	enabled: boolean;
	apiKey: string | null;
	model: string;
}> {
	const keys = ['recommendations.ai.enabled', 'recommendations.ai.apiKey', 'recommendations.ai.model'];
	const result = await db.select().from(settings).where(inArray(settings.key, keys));

	const settingsMap = new Map(result.map((s) => [s.key, s.value]));

	return {
		enabled: settingsMap.get('recommendations.ai.enabled') === 'true',
		apiKey: settingsMap.get('recommendations.ai.apiKey') || null,
		model: settingsMap.get('recommendations.ai.model') || 'gpt-4o-mini'
	};
}

/**
 * Save AI settings
 */
export async function saveAISettings(data: {
	enabled?: boolean;
	apiKey?: string;
	model?: string;
}): Promise<void> {
	const now = new Date().toISOString();

	if (data.enabled !== undefined) {
		await db
			.insert(settings)
			.values({
				key: 'recommendations.ai.enabled',
				value: data.enabled ? 'true' : 'false',
				type: 'boolean',
				category: 'recommendations',
				label: 'Enable AI Recommendations',
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: data.enabled ? 'true' : 'false', updatedAt: now }
			});
	}

	if (data.apiKey !== undefined) {
		await db
			.insert(settings)
			.values({
				key: 'recommendations.ai.apiKey',
				value: data.apiKey,
				type: 'string',
				category: 'recommendations',
				label: 'OpenAI API Key',
				isSystem: true,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: data.apiKey, updatedAt: now }
			});
	}

	if (data.model !== undefined) {
		await db
			.insert(settings)
			.values({
				key: 'recommendations.ai.model',
				value: data.model,
				type: 'string',
				category: 'recommendations',
				label: 'AI Model',
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: data.model, updatedAt: now }
			});
	}
}

/**
 * Test OpenAI API connection
 */
export async function testAIConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
				max_tokens: 10
			})
		});

		if (!response.ok) {
			const error = await response.json();
			return { success: false, error: error.error?.message || 'API request failed' };
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
	}
}

/**
 * Get top rated books for AI context
 */
async function getTopRatedBooks(limit: number = 20) {
	const result = await db
		.select({
			id: books.id,
			title: books.title,
			rating: books.rating,
			authorName: authors.name,
			genreName: genres.name
		})
		.from(books)
		.leftJoin(authors, eq(books.authorId, authors.id))
		.leftJoin(genres, eq(books.genreId, genres.id))
		.where(eq(books.statusId, STATUS_READ))
		.orderBy(desc(books.rating), desc(books.completedDate))
		.limit(limit);

	return result;
}

/**
 * Get AI-powered recommendations
 */
export async function getAIRecommendations(
	limit: number = 10
): Promise<{ recommendations: AIRecommendation[]; model: string; basedOnBooks: number } | { error: string }> {
	const aiSettings = await getAISettings();

	if (!aiSettings.enabled) {
		return { error: 'AI recommendations are disabled' };
	}

	if (!aiSettings.apiKey) {
		return { error: 'OpenAI API key not configured' };
	}

	// Get user's top rated books for context
	const topBooks = await getTopRatedBooks(20);

	if (topBooks.length < 3) {
		return { error: 'Need at least 3 read books for AI recommendations' };
	}

	// Build context for the prompt
	const bookContext = topBooks
		.map((b) => {
			const parts = [`"${b.title}" by ${b.authorName || 'Unknown'}`];
			if (b.genreName) parts.push(`(${b.genreName})`);
			if (b.rating) parts.push(`- ${b.rating}/5 stars`);
			return parts.join(' ');
		})
		.join('\n- ');

	const prompt = `Based on these books I've enjoyed reading (sorted by rating and recency):
- ${bookContext}

Please recommend ${limit} books I might enjoy that are NOT already in the list above. For each recommendation, provide:
1. Title (exact, searchable title)
2. Author name
3. A brief reason why I might like it based on my reading history

Format your response as a JSON array with objects containing: title, author, reason

Example format:
[{"title": "Book Title", "author": "Author Name", "reason": "Short reason..."}]`;

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${aiSettings.apiKey}`
			},
			body: JSON.stringify({
				model: aiSettings.model,
				messages: [
					{
						role: 'system',
						content:
							'You are a helpful book recommendation assistant. Always respond with valid JSON arrays only, no extra text.'
					},
					{ role: 'user', content: prompt }
				],
				temperature: 0.7,
				max_tokens: 2000
			})
		});

		if (!response.ok) {
			const error = await response.json();
			log.error('OpenAI API error', error);
			return { error: error.error?.message || 'Failed to get recommendations' };
		}

		const data = await response.json();
		const content = data.choices[0]?.message?.content || '[]';

		// Parse JSON response (handle potential extra text)
		let recommendations: AIRecommendation[];
		try {
			// Try direct parse first
			recommendations = JSON.parse(content);
		} catch {
			// Try to extract JSON from response
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				recommendations = JSON.parse(jsonMatch[0]);
			} else {
				log.error('Failed to parse AI response', { content });
				return { error: 'Failed to parse AI response' };
			}
		}

		// Check if recommended books exist in library
		const enrichedRecommendations = await Promise.all(
			recommendations.map(async (rec) => {
				const existingBook = await db
					.select({ id: books.id })
					.from(books)
					.where(sql`LOWER(${books.title}) = LOWER(${rec.title})`)
					.limit(1);

				return {
					...rec,
					inLibrary: existingBook.length > 0,
					bookId: existingBook[0]?.id
				};
			})
		);

		return {
			recommendations: enrichedRecommendations,
			model: aiSettings.model,
			basedOnBooks: topBooks.length
		};
	} catch (error) {
		log.error('AI recommendation error', { error });
		return { error: error instanceof Error ? error.message : 'Failed to get recommendations' };
	}
}

/**
 * Get rule-based recommendations (no AI needed)
 */
export async function getRuleBasedRecommendations(): Promise<RuleBasedRecommendation[]> {
	const recommendations: RuleBasedRecommendation[] = [];

	// 1. Continue your series - find series with unread books
	// Use raw SQL to avoid HAVING clause issues with non-aggregate queries
	const seriesProgress = await db.all<{
		seriesId: number;
		seriesTitle: string;
		totalBooks: number;
		readCount: number;
	}>(sql`
		SELECT
			s.id as seriesId,
			s.title as seriesTitle,
			s.numBooks as totalBooks,
			(SELECT COUNT(*) FROM books b WHERE b.seriesId = s.id AND b.statusId = ${STATUS_READ}) as readCount
		FROM series s
		WHERE s.numBooks IS NOT NULL
		AND (SELECT COUNT(*) FROM books b WHERE b.seriesId = s.id AND b.statusId = ${STATUS_READ}) > 0
		AND (SELECT COUNT(*) FROM books b WHERE b.seriesId = s.id AND b.statusId = ${STATUS_READ}) < s.numBooks
		LIMIT 5
	`);

	for (const sp of seriesProgress) {
		// Get unread books in this series
		const unreadBooks = await db
			.select({
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				bookNum: books.bookNum,
				authorName: authors.name
			})
			.from(books)
			.leftJoin(authors, eq(books.authorId, authors.id))
			.where(and(eq(books.seriesId, sp.seriesId), ne(books.statusId, STATUS_READ)))
			.orderBy(books.bookNum)
			.limit(3);

		if (unreadBooks.length > 0) {
			recommendations.push({
				type: 'series',
				title: 'Continue Your Series',
				subtitle: `${sp.seriesTitle} (${sp.readCount}/${sp.totalBooks} read)`,
				books: unreadBooks.map((b) => ({
					id: b.id,
					title: b.title,
					coverImageUrl: b.coverImageUrl,
					authorName: b.authorName,
					bookNum: b.bookNum
				}))
			});
		}
	}

	// 2. More from authors you love - find unread books from authors you've rated highly
	const topAuthors = await db
		.select({
			authorId: authors.id,
			authorName: authors.name,
			avgRating: sql<number>`AVG(${books.rating})`
		})
		.from(books)
		.innerJoin(authors, eq(books.authorId, authors.id))
		.where(and(eq(books.statusId, STATUS_READ), gt(books.rating, 3)))
		.groupBy(authors.id)
		.orderBy(desc(sql`AVG(${books.rating})`))
		.limit(5);

	for (const author of topAuthors) {
		const unreadBooks = await db
			.select({
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				seriesTitle: series.title,
				bookNum: books.bookNum
			})
			.from(books)
			.leftJoin(series, eq(books.seriesId, series.id))
			.where(and(eq(books.authorId, author.authorId), ne(books.statusId, STATUS_READ)))
			.limit(4);

		if (unreadBooks.length > 0) {
			recommendations.push({
				type: 'author',
				title: 'More From Authors You Love',
				subtitle: author.authorName || 'Unknown Author',
				books: unreadBooks.map((b) => ({
					id: b.id,
					title: b.title,
					coverImageUrl: b.coverImageUrl,
					authorName: author.authorName,
					seriesTitle: b.seriesTitle,
					bookNum: b.bookNum
				}))
			});
		}
	}

	// 3. More in genres you enjoy - find unread books in genres you've read a lot
	const topGenres = await db
		.select({
			genreId: genres.id,
			genreName: genres.name,
			bookCount: sql<number>`COUNT(*)`
		})
		.from(books)
		.innerJoin(genres, eq(books.genreId, genres.id))
		.where(eq(books.statusId, STATUS_READ))
		.groupBy(genres.id)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(3);

	for (const genre of topGenres) {
		const unreadBooks = await db
			.select({
				id: books.id,
				title: books.title,
				coverImageUrl: books.coverImageUrl,
				authorName: authors.name,
				seriesTitle: series.title
			})
			.from(books)
			.leftJoin(authors, eq(books.authorId, authors.id))
			.leftJoin(series, eq(books.seriesId, series.id))
			.where(and(eq(books.genreId, genre.genreId), ne(books.statusId, STATUS_READ)))
			.orderBy(desc(books.rating))
			.limit(4);

		if (unreadBooks.length > 0) {
			recommendations.push({
				type: 'genre',
				title: 'More In Genres You Enjoy',
				subtitle: genre.genreName || 'Unknown Genre',
				books: unreadBooks.map((b) => ({
					id: b.id,
					title: b.title,
					coverImageUrl: b.coverImageUrl,
					authorName: b.authorName,
					seriesTitle: b.seriesTitle
				}))
			});
		}
	}

	return recommendations;
}

/**
 * Get books similar to a specific book
 * Based on shared authors, series, genres, and tags
 */
export async function getSimilarBooks(bookId: number, limit: number = 8): Promise<{
	id: number;
	title: string;
	coverImageUrl: string | null;
	authorName: string | null;
	rating: number | null;
}[]> {
	// Get the source book's metadata
	const sourceBook = await db
		.select({
			id: books.id,
			authorId: books.authorId,
			seriesId: books.seriesId,
			genreId: books.genreId
		})
		.from(books)
		.where(eq(books.id, bookId))
		.limit(1);

	if (sourceBook.length === 0) {
		return [];
	}

	const source = sourceBook[0];

	// Get all authors for this book (from junction table)
	const bookAuthorIds = await db
		.select({ authorId: bookAuthors.authorId })
		.from(bookAuthors)
		.where(eq(bookAuthors.bookId, bookId));

	const authorIds = bookAuthorIds.map(ba => ba.authorId).filter((id): id is number => id !== null);
	if (source.authorId && !authorIds.includes(source.authorId)) {
		authorIds.push(source.authorId);
	}

	// Get all series for this book (from junction table)
	const bookSeriesIds = await db
		.select({ seriesId: bookSeries.seriesId })
		.from(bookSeries)
		.where(eq(bookSeries.bookId, bookId));

	const seriesIds = bookSeriesIds.map(bs => bs.seriesId).filter((id): id is number => id !== null);
	if (source.seriesId && !seriesIds.includes(source.seriesId)) {
		seriesIds.push(source.seriesId);
	}

	// Build a score-based query for similar books
	// Priority: Same series > Same author > Same genre
	const similarBooks = await db.all<{
		id: number;
		title: string;
		coverImageUrl: string | null;
		authorName: string | null;
		rating: number | null;
		relevanceScore: number;
	}>(sql`
		SELECT DISTINCT
			b.id,
			b.title,
			b.coverImageUrl,
			a.name as authorName,
			b.rating,
			(
				CASE WHEN b.seriesId IN (${seriesIds.length > 0 ? sql.join(seriesIds.map(id => sql`${id}`), sql`, `) : sql`-1`}) THEN 10 ELSE 0 END +
				CASE WHEN b.authorId IN (${authorIds.length > 0 ? sql.join(authorIds.map(id => sql`${id}`), sql`, `) : sql`-1`}) THEN 5 ELSE 0 END +
				CASE WHEN b.genreId = ${source.genreId} AND ${source.genreId} IS NOT NULL THEN 3 ELSE 0 END +
				CASE WHEN b.rating >= 4 THEN 2 ELSE 0 END
			) as relevanceScore
		FROM books b
		LEFT JOIN authors a ON b.authorId = a.id
		WHERE b.id != ${bookId}
		AND (
			b.seriesId IN (${seriesIds.length > 0 ? sql.join(seriesIds.map(id => sql`${id}`), sql`, `) : sql`-1`})
			OR b.authorId IN (${authorIds.length > 0 ? sql.join(authorIds.map(id => sql`${id}`), sql`, `) : sql`-1`})
			OR (b.genreId = ${source.genreId} AND ${source.genreId} IS NOT NULL)
		)
		ORDER BY relevanceScore DESC, b.rating DESC NULLS LAST
		LIMIT ${limit}
	`);

	return similarBooks.map(b => ({
		id: b.id,
		title: b.title,
		coverImageUrl: b.coverImageUrl,
		authorName: b.authorName,
		rating: b.rating
	}));
}

/**
 * Get AI recommendations based on a specific book
 */
export async function getAIRecommendationsForBook(
	bookId: number,
	limit: number = 5
): Promise<{ recommendations: AIRecommendation[]; model: string } | { error: string }> {
	const aiSettings = await getAISettings();

	if (!aiSettings.enabled) {
		return { error: 'AI recommendations are disabled. Enable them in Admin Settings.' };
	}

	if (!aiSettings.apiKey) {
		return { error: 'OpenAI API key not configured. Set it in Admin Settings.' };
	}

	// Get the book with all its details
	const bookResult = await db
		.select({
			id: books.id,
			title: books.title,
			authorName: authors.name,
			seriesTitle: series.title,
			bookNum: books.bookNum,
			genreName: genres.name,
			summary: books.summary,
			rating: books.rating
		})
		.from(books)
		.leftJoin(authors, eq(books.authorId, authors.id))
		.leftJoin(series, eq(books.seriesId, series.id))
		.leftJoin(genres, eq(books.genreId, genres.id))
		.where(eq(books.id, bookId))
		.limit(1);

	if (bookResult.length === 0) {
		return { error: 'Book not found' };
	}

	const book = bookResult[0];

	// Get all authors for this book
	const bookAuthorRows = await db
		.select({ name: authors.name, role: bookAuthors.role })
		.from(bookAuthors)
		.innerJoin(authors, eq(bookAuthors.authorId, authors.id))
		.where(eq(bookAuthors.bookId, bookId));

	const authorNames = bookAuthorRows.length > 0
		? bookAuthorRows.map(a => a.name).join(', ')
		: book.authorName || 'Unknown Author';

	// Get all series for this book
	const bookSeriesRows = await db
		.select({ title: series.title, bookNum: bookSeries.bookNum })
		.from(bookSeries)
		.innerJoin(series, eq(bookSeries.seriesId, series.id))
		.where(eq(bookSeries.bookId, bookId));

	const seriesInfo = bookSeriesRows.length > 0
		? bookSeriesRows.map(s => `${s.title}${s.bookNum ? ` #${s.bookNum}` : ''}`).join(', ')
		: book.seriesTitle
			? `${book.seriesTitle}${book.bookNum ? ` #${book.bookNum}` : ''}`
			: null;

	// Build context for the prompt
	let bookContext = `"${book.title}" by ${authorNames}`;
	if (seriesInfo) bookContext += `\nSeries: ${seriesInfo}`;
	if (book.genreName) bookContext += `\nGenre: ${book.genreName}`;
	if (book.summary) {
		// Truncate summary to avoid token limits
		const shortSummary = book.summary.length > 500
			? book.summary.substring(0, 500) + '...'
			: book.summary;
		bookContext += `\nSummary: ${shortSummary}`;
	}

	const prompt = `I just finished reading this book:

${bookContext}

Please recommend ${limit} similar books I might enjoy. Consider:
- The author's writing style and other works
- The series if applicable (similar series in the genre)
- The themes, tone, and genre
- Books that fans of this book typically enjoy

For each recommendation, provide:
1. Title (exact, searchable title)
2. Author name
3. A brief reason why someone who liked the book above would enjoy this one

Format your response as a JSON array with objects containing: title, author, reason

Example format:
[{"title": "Book Title", "author": "Author Name", "reason": "Short reason..."}]`;

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${aiSettings.apiKey}`
			},
			body: JSON.stringify({
				model: aiSettings.model,
				messages: [
					{
						role: 'system',
						content:
							'You are a knowledgeable book recommendation assistant. Always respond with valid JSON arrays only, no extra text. Recommend well-known, real books that are actually similar to the given book.'
					},
					{ role: 'user', content: prompt }
				],
				temperature: 0.7,
				max_tokens: 1500
			})
		});

		if (!response.ok) {
			const error = await response.json();
			log.error('OpenAI API error for book recommendation', error);
			return { error: error.error?.message || 'Failed to get recommendations' };
		}

		const data = await response.json();
		const content = data.choices[0]?.message?.content || '[]';

		// Parse JSON response
		let recommendations: AIRecommendation[];
		try {
			recommendations = JSON.parse(content);
		} catch {
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				recommendations = JSON.parse(jsonMatch[0]);
			} else {
				log.error('Failed to parse AI response for book', { content });
				return { error: 'Failed to parse AI response' };
			}
		}

		// Check if recommended books exist in library
		const enrichedRecommendations = await Promise.all(
			recommendations.map(async (rec) => {
				const existingBook = await db
					.select({ id: books.id })
					.from(books)
					.where(sql`LOWER(${books.title}) = LOWER(${rec.title})`)
					.limit(1);

				return {
					...rec,
					inLibrary: existingBook.length > 0,
					bookId: existingBook[0]?.id
				};
			})
		);

		return {
			recommendations: enrichedRecommendations,
			model: aiSettings.model
		};
	} catch (error) {
		log.error('AI book recommendation error', { error, bookId });
		return { error: error instanceof Error ? error.message : 'Failed to get recommendations' };
	}
}

/**
 * Add AI recommendation to library as wishlist item
 */
export async function addRecommendationToLibrary(data: {
	title: string;
	author: string;
	genre?: string;
}): Promise<{ success: boolean; bookId?: number; error?: string }> {
	try {
		// Check if book already exists
		const existing = await db
			.select({ id: books.id })
			.from(books)
			.where(sql`LOWER(${books.title}) = LOWER(${data.title})`)
			.limit(1);

		if (existing.length > 0) {
			return { success: false, error: 'Book already in library', bookId: existing[0].id };
		}

		// Find or create author
		let authorId: number | null = null;
		if (data.author) {
			const existingAuthor = await db
				.select({ id: authors.id })
				.from(authors)
				.where(sql`LOWER(${authors.name}) = LOWER(${data.author})`)
				.limit(1);

			if (existingAuthor.length > 0) {
				authorId = existingAuthor[0].id;
			} else {
				const [newAuthor] = await db
					.insert(authors)
					.values({
						name: data.author,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString()
					})
					.returning({ id: authors.id });
				authorId = newAuthor.id;
			}
		}

		// Find genre if provided
		let genreId: number | null = null;
		if (data.genre) {
			const existingGenre = await db
				.select({ id: genres.id })
				.from(genres)
				.where(sql`LOWER(${genres.name}) = LOWER(${data.genre})`)
				.limit(1);
			genreId = existingGenre[0]?.id || null;
		}

		// Create the book
		const [newBook] = await db
			.insert(books)
			.values({
				title: data.title,
				authorId,
				genreId,
				statusId: STATUS_WISHLIST,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			})
			.returning({ id: books.id });

		// Link author via junction table
		if (authorId) {
			const now = new Date().toISOString();
			await db.insert(bookAuthors).values({
				bookId: newBook.id,
				authorId,
				isPrimary: true,
				displayOrder: 0,
				createdAt: now,
				updatedAt: now
			});
		}

		log.info('Added AI recommendation to library', { title: data.title, bookId: newBook.id });
		return { success: true, bookId: newBook.id };
	} catch (error) {
		log.error('Failed to add recommendation to library', { error });
		return { success: false, error: 'Failed to add book to library' };
	}
}
