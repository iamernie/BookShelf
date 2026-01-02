/**
 * Google Books Metadata Provider
 * Uses the official Google Books API (no auth required)
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult
} from './types';
import {
	normalizeIsbn,
	extractYear,
	mapLanguageCode,
	decodeHtmlEntities
} from './types';

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

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

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
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
			return [];
		}

		const cacheKey = `google:${query}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			const url = new URL(GOOGLE_BOOKS_API_URL);
			url.searchParams.set('q', query);
			url.searchParams.set('maxResults', String(Math.min(limit, 40)));

			const res = await fetch(url.toString());
			if (!res.ok) return [];

			const data: GoogleBooksResponse = await res.json();
			if (!data.items || data.items.length === 0) return [];

			const results = data.items.map((item) => this.mapToResult(item));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results;
		} catch (error) {
			console.error('Google Books search error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		const cacheKey = `google:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const res = await fetch(`${GOOGLE_BOOKS_API_URL}/${providerId}`);
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
			coverUrl =
				info.imageLinks.extraLarge ||
				info.imageLinks.large ||
				info.imageLinks.medium ||
				info.imageLinks.small ||
				info.imageLinks.thumbnail;

			thumbnailUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;

			// Convert to https and improve quality
			if (coverUrl) {
				coverUrl = coverUrl.replace('http://', 'https://');
				coverUrl = coverUrl.replace('&zoom=1', '&zoom=2');
				coverUrl = coverUrl.replace('&edge=curl', '');
			}
			if (thumbnailUrl) {
				thumbnailUrl = thumbnailUrl.replace('http://', 'https://');
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
			description: decodeHtmlEntities(info.description),
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
