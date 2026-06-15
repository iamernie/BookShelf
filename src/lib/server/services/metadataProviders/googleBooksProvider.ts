/**
 * Google Books Metadata Provider
 * Uses the official Google Books API (no auth required)
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	MetadataSearchResponse,
	BookMetadataResult
} from './types';
import {
	normalizeIsbn,
	extractYear,
	mapLanguageCode,
	decodeHtmlEntities,
	stripHtmlTags
} from './types';

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

// Browser-like user agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

interface GoogleVolumeInfo {
	title?: string;
	subtitle?: string;
	authors?: string[];
	publisher?: string;
	publishedDate?: string;
	description?: string;
	pageCount?: number;
	language?: string;
	categories?: string[];
	industryIdentifiers?: { type: string; identifier: string }[];
	imageLinks?: {
		smallThumbnail?: string;
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		extraLarge?: string;
	};
	averageRating?: number;
	ratingsCount?: number;
}

interface GoogleBookItem {
	id: string;
	volumeInfo: GoogleVolumeInfo;
}

interface GoogleBooksResponse {
	totalItems: number;
	items?: GoogleBookItem[];
}

export class GoogleBooksProvider implements MetadataProviderInterface {
	readonly name = 'googlebooks' as const;
	readonly displayName = 'Google Books';
	readonly requiresAuth = false;

	private apiKey: string | null = null;

	setApiKey(apiKey: string): void {
		this.apiKey = apiKey || null;
	}

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		const response = await this.searchWithStatus(request, limit);
		return response.results;
	}

	async searchWithStatus(request: MetadataSearchRequest, limit = 10): Promise<MetadataSearchResponse> {
		console.log('[googlebooks] searchWithStatus called:', { request, limit, hasApiKey: !!this.apiKey });
		let query = '';

		// Build search query
		if (request.isbn) {
			const cleanIsbn = normalizeIsbn(request.isbn);
			query = `isbn:${cleanIsbn}`;
		} else {
			if (request.title) {
				query = `intitle:${request.title}`;
			}
			if (request.author) {
				query += (query ? ' ' : '') + `inauthor:${request.author}`;
			}
		}

		if (!query) {
			return { results: [] };
		}

		const cacheKey = `google:${query}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return { results: cached.data as BookMetadataResult[] };
		}

		try {
			const url = new URL(GOOGLE_BOOKS_API_URL);
			url.searchParams.set('q', query);
			url.searchParams.set('maxResults', String(Math.min(limit, 40)));
			if (this.apiKey) {
				url.searchParams.set('key', this.apiKey);
			}

			console.log('[googlebooks] Fetching:', url.toString().replace(/key=[^&]+/, 'key=***'));
			const res = await fetch(url.toString(), {
				headers: {
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.9',
					'User-Agent': USER_AGENT
				}
			});

			if (!res.ok) {
				// Check for specific error codes
				if (res.status === 429) {
					console.error('Google Books API: Rate limit exceeded (429)');
					return {
						results: [],
						error: 'Google Books API rate limit exceeded. Please try again later.',
						errorCode: 'RATE_LIMITED'
					};
				}

				// Try to parse error response
				try {
					const errorData = await res.json();
					if (errorData.error?.status === 'RESOURCE_EXHAUSTED') {
						console.error('Google Books API: Quota exceeded');
						return {
							results: [],
							error: 'Google Books API daily quota exceeded. Try again tomorrow or add an API key.',
							errorCode: 'QUOTA_EXCEEDED'
						};
					}
				} catch {
					// Ignore JSON parse errors
				}

				console.error(`Google Books API error: ${res.status}`);
				return {
					results: [],
					error: `Google Books API error (${res.status})`,
					errorCode: 'NETWORK_ERROR'
				};
			}

			const data: GoogleBooksResponse = await res.json();

			// Check for quota exceeded in response body
			if ('error' in data && (data as { error?: { status?: string } }).error?.status === 'RESOURCE_EXHAUSTED') {
				return {
					results: [],
					error: 'Google Books API daily quota exceeded. Try again tomorrow or add an API key.',
					errorCode: 'QUOTA_EXCEEDED'
				};
			}

			if (!data.items || data.items.length === 0) {
				return { results: [] };
			}

			const results = data.items.map((item) => this.mapToResult(item));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return { results };
		} catch (error) {
			console.error('Google Books search error:', error);
			return {
				results: [],
				error: 'Failed to connect to Google Books API',
				errorCode: 'NETWORK_ERROR'
			};
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		const cacheKey = `google:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const url = new URL(`${GOOGLE_BOOKS_API_URL}/${providerId}`);
			if (this.apiKey) {
				url.searchParams.set('key', this.apiKey);
			}

			const res = await fetch(url.toString(), {
				headers: {
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.9',
					'User-Agent': USER_AGENT
				}
			});
			if (!res.ok) return null;

			const item: GoogleBookItem = await res.json();
			const result = this.mapToResult(item);

			cache.set(cacheKey, { data: result, timestamp: Date.now() });
			return result;
		} catch (error) {
			console.error('Google Books fetch error:', error);
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		return true; // Google Books API is always available
	}

	private mapToResult(item: GoogleBookItem): BookMetadataResult {
		const info = item.volumeInfo;

		// Get best cover image
		let coverUrl: string | undefined;
		let thumbnailUrl: string | undefined;
		if (info.imageLinks) {
			// Prefer higher quality images if available
			const bestImage =
				info.imageLinks.extraLarge ||
				info.imageLinks.large ||
				info.imageLinks.medium ||
				info.imageLinks.small ||
				info.imageLinks.thumbnail;

			thumbnailUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;

			// Process the cover URL
			if (bestImage) {
				coverUrl = bestImage.replace('http://', 'https://');
				// Remove curl effect
				coverUrl = coverUrl.replace('&edge=curl', '');
				// Use zoom=1 which is more reliable than higher zoom levels
				// Higher zoom levels often return blank/placeholder images
				coverUrl = coverUrl.replace(/&zoom=\d/, '&zoom=1');
			}

			// Process thumbnail URL
			if (thumbnailUrl) {
				thumbnailUrl = thumbnailUrl.replace('http://', 'https://');
				thumbnailUrl = thumbnailUrl.replace('&edge=curl', '');
			}

			// If we only have thumbnail, use it as coverUrl too (better than nothing)
			if (!coverUrl && thumbnailUrl) {
				coverUrl = thumbnailUrl;
			}
		}

		// Extract ISBNs
		let isbn10: string | undefined;
		let isbn13: string | undefined;
		if (info.industryIdentifiers) {
			for (const id of info.industryIdentifiers) {
				if (id.type === 'ISBN_13') isbn13 = id.identifier;
				if (id.type === 'ISBN_10') isbn10 = id.identifier;
			}
		}

		return {
			provider: 'googlebooks',
			providerId: item.id,
			title: decodeHtmlEntities(info.title),
			subtitle: decodeHtmlEntities(info.subtitle),
			authors: info.authors,
			description: stripHtmlTags(decodeHtmlEntities(info.description)),
			publisher: info.publisher,
			publishedDate: info.publishedDate,
			publishYear: extractYear(info.publishedDate),
			pageCount: info.pageCount,
			language: mapLanguageCode(info.language),
			isbn10,
			isbn13,
			coverUrl,
			thumbnailUrl,
			genres: info.categories,
			rating: info.averageRating,
			ratingCount: info.ratingsCount
		};
	}
}
