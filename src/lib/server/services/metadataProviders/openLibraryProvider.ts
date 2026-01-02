/**
 * Open Library Metadata Provider
 * Uses the Open Library API (no auth required)
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

const OPEN_LIBRARY_API = 'https://openlibrary.org';

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

export class OpenLibraryProvider implements MetadataProviderInterface {
	readonly name = 'openlibrary' as const;
	readonly displayName = 'Open Library';
	readonly requiresAuth = false;

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		let query = '';

		// Build search query
		if (request.isbn) {
			const cleanIsbn = normalizeIsbn(request.isbn);
			return this.searchByIsbn(cleanIsbn);
		}

		// Title/author search
		const parts: string[] = [];
		if (request.title) {
			parts.push(request.title);
		}
		if (request.author) {
			parts.push(request.author);
		}
		query = parts.join(' ');

		if (!query) {
			return [];
		}

		const cacheKey = `ol:search:${query}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			const encoded = encodeURIComponent(query);
			const requestLimit = Math.min(limit * 2, 40);
			const url = `${OPEN_LIBRARY_API}/search.json?q=${encoded}&limit=${requestLimit}&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median,subject,language`;

			const res = await fetch(url);
			if (!res.ok) return [];

			const data = await res.json();
			if (!data.docs || data.docs.length === 0) return [];

			const results = data.docs.map((doc: OpenLibrarySearchDoc) => this.mapSearchResult(doc));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results.slice(0, limit);
		} catch (error) {
			console.error('Open Library search error:', error);
			return [];
		}
	}

	private async searchByIsbn(isbn: string): Promise<BookMetadataResult[]> {
		const cacheKey = `ol:isbn:${isbn}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			const data = cached.data as BookMetadataResult | null;
			return data ? [data] : [];
		}

		try {
			const res = await fetch(
				`${OPEN_LIBRARY_API}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
			);

			if (!res.ok) return [];

			const data = await res.json();
			const bookData = data[`ISBN:${isbn}`];

			if (!bookData) return [];

			const result = this.mapIsbnResult(bookData, isbn);
			cache.set(cacheKey, { data: result, timestamp: Date.now() });
			return [result];
		} catch (error) {
			console.error('Open Library ISBN lookup error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		// providerId is the Open Library key like "/works/OL123W"
		const cacheKey = `ol:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const res = await fetch(`${OPEN_LIBRARY_API}${providerId}.json`);
			if (!res.ok) return null;

			const workData = await res.json();

			// Get author names
			const authorNames: string[] = [];
			if (workData.authors) {
				for (const authorRef of workData.authors.slice(0, 5)) {
					try {
						const authorKey = authorRef.author?.key || authorRef.key;
						if (authorKey) {
							const authorRes = await fetch(`${OPEN_LIBRARY_API}${authorKey}.json`);
							if (authorRes.ok) {
								const authorData = await authorRes.json();
								if (authorData.name) {
									authorNames.push(authorData.name);
								}
							}
						}
					} catch {
						// Skip failed author lookups
					}
				}
			}

			const description =
				typeof workData.description === 'string'
					? workData.description
					: workData.description?.value;

			const result: BookMetadataResult = {
				provider: 'openlibrary',
				providerId,
				title: decodeHtmlEntities(workData.title),
				authors: authorNames.length > 0 ? authorNames : undefined,
				description: decodeHtmlEntities(description),
				subjects: workData.subjects?.slice(0, 10),
				coverUrl: workData.covers?.[0]
					? `https://covers.openlibrary.org/b/id/${workData.covers[0]}-L.jpg`
					: undefined
			};

			cache.set(cacheKey, { data: result, timestamp: Date.now() });
			return result;
		} catch (error) {
			console.error('Open Library fetch error:', error);
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		return true; // Open Library is always available
	}

	private mapSearchResult(doc: OpenLibrarySearchDoc): BookMetadataResult {
		const languages = doc.language || [];
		const primaryLang = languages.length > 0 ? mapLanguageCode(languages[0]) : undefined;

		return {
			provider: 'openlibrary',
			providerId: doc.key,
			title: decodeHtmlEntities(doc.title),
			authors: doc.author_name,
			publishYear: doc.first_publish_year,
			publisher: doc.publisher?.[0],
			pageCount: doc.number_of_pages_median,
			language: primaryLang,
			subjects: doc.subject?.slice(0, 5),
			isbn13: doc.isbn?.find((i: string) => i.length === 13),
			isbn10: doc.isbn?.find((i: string) => i.length === 10),
			coverUrl: doc.cover_i
				? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
				: undefined,
			thumbnailUrl: doc.cover_i
				? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
				: undefined
		};
	}

	private mapIsbnResult(bookData: OpenLibraryIsbnData, isbn: string): BookMetadataResult {
		// Get cover URL - prefer larger sizes
		let coverUrl: string | undefined;
		if (bookData.cover) {
			coverUrl = bookData.cover.large || bookData.cover.medium || bookData.cover.small;
		}

		return {
			provider: 'openlibrary',
			providerId: bookData.key,
			title: decodeHtmlEntities(bookData.title),
			authors: bookData.authors?.map((a: { name: string }) => a.name),
			publisher: bookData.publishers?.[0]?.name,
			publishYear: extractYear(bookData.publish_date),
			publishedDate: bookData.publish_date,
			pageCount: bookData.number_of_pages,
			language: mapLanguageCode(bookData.languages?.[0]?.key?.split('/').pop()),
			description: decodeHtmlEntities(bookData.notes),
			subjects: bookData.subjects?.slice(0, 5).map((s: { name: string }) => s.name),
			coverUrl,
			isbn13: isbn.length === 13 ? isbn : undefined,
			isbn10: isbn.length === 10 ? isbn : undefined
		};
	}
}

interface OpenLibrarySearchDoc {
	key?: string;
	title?: string;
	author_name?: string[];
	first_publish_year?: number;
	isbn?: string[];
	cover_i?: number;
	publisher?: string[];
	number_of_pages_median?: number;
	subject?: string[];
	language?: string[];
}

interface OpenLibraryIsbnData {
	key?: string;
	title?: string;
	authors?: { name: string }[];
	publishers?: { name: string }[];
	publish_date?: string;
	number_of_pages?: number;
	languages?: { key: string }[];
	notes?: string;
	subjects?: { name: string }[];
	cover?: {
		small?: string;
		medium?: string;
		large?: string;
	};
}
