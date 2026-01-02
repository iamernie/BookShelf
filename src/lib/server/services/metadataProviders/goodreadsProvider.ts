/**
 * Goodreads Metadata Provider
 * Scrapes book data from Goodreads using embedded JSON
 *
 * Based on BookLore's GoodReadsParser approach:
 * - Search returns book previews from search results page
 * - Details are extracted from __NEXT_DATA__ JSON in book pages
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult,
	BookReview
} from './types';
import { decodeHtmlEntities } from './types';

const GOODREADS_BASE = 'https://www.goodreads.com';
const SEARCH_URL = `${GOODREADS_BASE}/search?q=`;
const BOOK_URL = `${GOODREADS_BASE}/book/show/`;
const ISBN_URL = `${GOODREADS_BASE}/book/isbn/`;

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

// Rate limiting - 1 second between requests
let lastRequestTime = 0;
const RATE_LIMIT_MS = 1000;

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < RATE_LIMIT_MS) {
		await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
	}
	lastRequestTime = Date.now();

	return fetch(url, {
		headers: {
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.9',
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
		}
	});
}

/**
 * Extract __NEXT_DATA__ JSON from HTML
 */
function extractNextData(html: string): GoodreadsNextData | null {
	const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
	if (!match) return null;

	try {
		return JSON.parse(match[1]);
	} catch {
		return null;
	}
}

/**
 * Parse Goodreads book ID from URL path
 */
function parseGoodreadsId(href: string): string | null {
	const match = href.match(/\/book\/show\/(\d+)/);
	return match ? match[1] : null;
}

/**
 * Extract search results from HTML (simple regex-based parsing)
 */
function parseSearchResults(html: string): GoodreadsSearchResult[] {
	const results: GoodreadsSearchResult[] = [];

	// Find all book rows in search results table
	const bookPattern =
		/<tr itemscope itemtype="http:\/\/schema\.org\/Book"[\s\S]*?<\/tr>/g;
	const bookMatches = html.matchAll(bookPattern);

	for (const match of bookMatches) {
		const row = match[0];

		// Extract book link and ID - try multiple patterns
		// Pattern 1: Title text directly in anchor
		let linkMatch = row.match(/<a class="bookTitle"[^>]*href="([^"]+)"[^>]*>([^<]+)</);

		// Pattern 2: Title may have nested span or other elements
		if (!linkMatch || !linkMatch[2]?.trim()) {
			linkMatch = row.match(/<a class="bookTitle"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
		}

		if (!linkMatch) continue;

		const href = linkMatch[1] || '';
		// Strip any HTML tags from the title (in case of nested elements)
		let title: string = (linkMatch[2] || '').replace(/<[^>]*>/g, '').trim();
		title = decodeHtmlEntities(title) || title;

		const goodreadsId = parseGoodreadsId(href);
		if (!goodreadsId) continue;

		// Extract author - try multiple patterns
		let authorMatch = row.match(/<a class="authorName"[^>]*>([^<]+)</);
		if (!authorMatch) {
			// Try pattern where author name might have nested elements
			authorMatch = row.match(/<a class="authorName"[^>]*>([\s\S]*?)<\/a>/);
		}
		let author: string | undefined;
		if (authorMatch) {
			author = authorMatch[1].replace(/<[^>]*>/g, '').trim();
			author = decodeHtmlEntities(author);
		}

		// Extract cover image - try multiple patterns
		let coverMatch = row.match(/<img[^>]*src="([^"]+)"[^>]*class="bookCover"/);
		if (!coverMatch) {
			// Alternative: class before src
			coverMatch = row.match(/<img[^>]*class="bookCover"[^>]*src="([^"]+)"/);
		}
		if (!coverMatch) {
			// Just find any image in the row
			coverMatch = row.match(/<img[^>]*src="(https?:\/\/[^"]+)"/);
		}
		const coverUrl = coverMatch ? coverMatch[1] : undefined;

		results.push({
			goodreadsId,
			title: title || '',
			author,
			coverUrl
		});
	}

	return results;
}

export class GoodreadsProvider implements MetadataProviderInterface {
	readonly name = 'goodreads' as const;
	readonly displayName = 'Goodreads';
	readonly requiresAuth = false;

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		// Build search query
		let searchTerm = '';
		if (request.isbn) {
			searchTerm = request.isbn.replace(/[-\s]/g, '');
		} else {
			const parts: string[] = [];
			if (request.title) parts.push(request.title);
			if (request.author) parts.push(request.author);
			searchTerm = parts.join(' ');
		}

		if (!searchTerm) {
			return [];
		}

		const cacheKey = `gr:search:${searchTerm}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			const url = SEARCH_URL + encodeURIComponent(searchTerm);
			const res = await rateLimitedFetch(url);

			if (!res.ok) return [];

			const html = await res.text();
			const searchResults = parseSearchResults(html);

			// Convert to BookMetadataResult
			const results: BookMetadataResult[] = searchResults.slice(0, limit).map((r) => ({
				provider: 'goodreads',
				providerId: r.goodreadsId,
				title: r.title,
				authors: r.author ? [r.author] : undefined,
				thumbnailUrl: r.coverUrl
			}));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results;
		} catch (error) {
			console.error('Goodreads search error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		const cacheKey = `gr:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const url = BOOK_URL + providerId;
			const res = await rateLimitedFetch(url);

			if (!res.ok) return null;

			const html = await res.text();
			const nextData = extractNextData(html);

			if (!nextData) {
				console.error('Goodreads: Could not find __NEXT_DATA__');
				return null;
			}

			const result = this.parseBookDetails(nextData, providerId);
			if (result) {
				cache.set(cacheKey, { data: result, timestamp: Date.now() });
			}
			return result;
		} catch (error) {
			console.error('Goodreads fetch error:', error);
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		// Could add a health check here
		return true;
	}

	private parseBookDetails(
		nextData: GoodreadsNextData,
		goodreadsId: string
	): BookMetadataResult | null {
		try {
			const apolloState = nextData.props?.pageProps?.apolloState;
			if (!apolloState) return null;

			// Find keys for different data types
			const keys = Object.keys(apolloState);
			const bookKey = keys.find((k) => {
				if (!k.startsWith('Book:kca:')) return false;
				const item = apolloState[k] as GoodreadsBookData | undefined;
				return item?.title;
			});
			const workKey = keys.find((k) => k.startsWith('Work:kca:'));
			const contributorKey = keys.find((k) => k.startsWith('Contributor:kca'));
			const seriesKey = keys.find((k) => k.startsWith('Series:kca'));

			if (!bookKey) return null;

			const bookData = apolloState[bookKey] as GoodreadsBookData;
			const workData = workKey ? (apolloState[workKey] as GoodreadsWorkData) : null;

			// Extract title and subtitle
			const fullTitle = bookData.title || '';
			const [title, subtitle] = fullTitle.includes(':')
				? fullTitle.split(':', 2).map((s: string) => s.trim())
				: [fullTitle, undefined];

			// Extract author
			let authors: string[] | undefined;
			if (contributorKey) {
				const contributor = apolloState[contributorKey] as GoodreadsContributor | undefined;
				if (contributor?.name) {
					authors = [contributor.name];
				}
			}

			// Extract series info
			let seriesName: string | undefined;
			let seriesNumber: number | undefined;
			if (seriesKey) {
				const series = apolloState[seriesKey] as GoodreadsSeries | undefined;
				seriesName = series?.title;
			}
			if (bookData.bookSeries?.[0]?.userPosition) {
				seriesNumber = parseFloat(bookData.bookSeries[0].userPosition);
			}

			// Extract details
			const details = bookData.details || {};

			// Extract genres
			let genres: string[] | undefined;
			if (bookData.bookGenres) {
				genres = bookData.bookGenres
					.map((g) => g.genre?.name)
					.filter((name): name is string => !!name);
			}

			// Extract ratings from work
			let rating: number | undefined;
			let ratingCount: number | undefined;
			if (workData?.stats) {
				rating = workData.stats.averageRating ? parseFloat(workData.stats.averageRating) : undefined;
				ratingCount = workData.stats.ratingsCount ? parseInt(workData.stats.ratingsCount) : undefined;
			}

			// Extract reviews
			const reviews = this.extractReviews(apolloState, keys);

			// Parse publication date
			let publishYear: number | undefined;
			let publishedDate: string | undefined;
			if (details.publicationTime) {
				const date = new Date(parseInt(details.publicationTime));
				if (!isNaN(date.getTime())) {
					publishYear = date.getFullYear();
					publishedDate = date.toISOString().split('T')[0];
				}
			}

			return {
				provider: 'goodreads',
				providerId: goodreadsId,
				title: this.cleanString(title),
				subtitle: this.cleanString(subtitle),
				authors,
				description: this.cleanString(bookData.description),
				publisher: this.cleanString(details.publisher),
				publishYear,
				publishedDate,
				pageCount: details.numPages ? parseInt(details.numPages) : undefined,
				language: details.language?.name,
				isbn10: this.cleanString(details.isbn),
				isbn13: this.cleanString(details.isbn13),
				coverUrl: bookData.imageUrl,
				genres,
				seriesName,
				seriesNumber,
				rating,
				ratingCount,
				reviews: reviews.length > 0 ? reviews : undefined
			};
		} catch (error) {
			console.error('Error parsing Goodreads book details:', error);
			return null;
		}
	}

	private extractReviews(apolloState: Record<string, unknown>, keys: string[]): BookReview[] {
		const reviews: BookReview[] = [];
		const reviewKeys = keys.filter((k) => k.startsWith('Review:kca'));

		for (const reviewKey of reviewKeys.slice(0, 5)) {
			// Limit to 5 reviews
			try {
				const reviewData = apolloState[reviewKey] as GoodreadsReviewData;
				if (!reviewData?.text) continue;

				// Strip HTML from review text
				const plainText = reviewData.text.replace(/<[^>]*>/g, '').trim();
				if (!plainText) continue;

				// Get reviewer name
				let reviewerName: string | undefined;
				if (reviewData.creator?.__ref) {
					const userKey = reviewData.creator.__ref;
					const userData = apolloState[userKey] as { name?: string } | undefined;
					reviewerName = userData?.name;
				}

				reviews.push({
					reviewerName,
					rating: reviewData.rating ? parseFloat(reviewData.rating) : undefined,
					body: plainText,
					date: reviewData.updatedAt
						? new Date(parseInt(reviewData.updatedAt)).toISOString()
						: undefined,
					spoiler: reviewData.spoilerStatus || false
				});
			} catch {
				// Skip malformed reviews
			}
		}

		return reviews;
	}

	private cleanString(value: unknown): string | undefined {
		if (typeof value !== 'string') return undefined;
		if (value === 'null' || value === '') return undefined;
		return value;
	}
}

interface GoodreadsSearchResult {
	goodreadsId: string;
	title: string;
	author?: string;
	coverUrl?: string;
}

// Type definitions for Goodreads Apollo state
interface GoodreadsApolloState {
	[key: string]: GoodreadsBookData | GoodreadsWorkData | GoodreadsContributor | GoodreadsSeries | GoodreadsReviewData | { name?: string } | unknown;
}

interface GoodreadsBookData {
	title?: string;
	description?: string;
	imageUrl?: string;
	bookGenres?: Array<{ genre?: { name?: string } }>;
	bookSeries?: Array<{ userPosition?: string }>;
	details?: {
		publisher?: string;
		publicationTime?: string;
		numPages?: string;
		isbn?: string;
		isbn13?: string;
		language?: { name?: string };
	};
}

interface GoodreadsWorkData {
	stats?: {
		averageRating?: string;
		ratingsCount?: string;
	};
}

interface GoodreadsContributor {
	name?: string;
}

interface GoodreadsSeries {
	title?: string;
}

interface GoodreadsNextData {
	props?: {
		pageProps?: {
			apolloState?: GoodreadsApolloState;
		};
	};
}

interface GoodreadsReviewData {
	text?: string;
	rating?: string;
	updatedAt?: string;
	spoilerStatus?: boolean;
	creator?: {
		__ref?: string;
	};
}
