/**
 * Hardcover Metadata Provider
 * Uses Hardcover's GraphQL API
 *
 * Note: Requires an API key from https://hardcover.app/account/api
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult
} from './types';
import { decodeHtmlEntities, extractYear } from './types';

const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql';

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

interface HardcoverConfig {
	apiKey?: string;
}

// GraphQL response types
interface HardcoverDocument {
	id: string;
	slug: string;
	title: string;
	subtitle?: string;
	author_names?: string[];
	description?: string;
	isbns?: string[];
	rating?: number;
	ratings_count?: number;
	pages?: number;
	release_date?: string;
	release_year?: number;
	genres?: string[];
	moods?: string[];
	tags?: string[];
	featured_series?: {
		position?: number;
		series?: {
			name?: string;
			books_count?: number;
		};
	};
	image?: {
		url?: string;
	};
}

interface HardcoverHit {
	document: HardcoverDocument;
}

interface HardcoverGraphQLResponse {
	data?: {
		search?: {
			results?: {
				hits?: HardcoverHit[];
			};
		};
	};
	errors?: { message: string }[];
}

export class HardcoverProvider implements MetadataProviderInterface {
	readonly name = 'hardcover' as const;
	readonly displayName = 'Hardcover';
	readonly requiresAuth = true;

	private config: HardcoverConfig;

	constructor(config: HardcoverConfig = {}) {
		this.config = config;
	}

	/**
	 * Update the API key (can be called when settings change)
	 */
	setApiKey(apiKey: string): void {
		this.config.apiKey = apiKey;
	}

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		if (!this.config.apiKey) {
			console.warn('Hardcover: API key not configured');
			return [];
		}

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

		const cacheKey = `hc:search:${searchTerm}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			const perPage = Math.min(limit, 20);
			const graphqlQuery = `
				query SearchBooks {
					search(query: "${searchTerm.replace(/"/g, '\\"')}", query_type: "Book", per_page: ${perPage}, page: 1) {
						results
					}
				}
			`;

			const res = await fetch(HARDCOVER_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.config.apiKey}`
				},
				body: JSON.stringify({
					query: graphqlQuery,
					variables: {}
				})
			});

			if (!res.ok) {
				console.error('Hardcover API error:', res.status, res.statusText);
				return [];
			}

			const response: HardcoverGraphQLResponse = await res.json();

			if (response.errors) {
				console.error('Hardcover GraphQL errors:', response.errors);
				return [];
			}

			const hits = response.data?.search?.results?.hits || [];
			const results = hits.map((hit) => this.mapToResult(hit.document));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results;
		} catch (error) {
			console.error('Hardcover search error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		// For Hardcover, the search returns full details, so we can just cache
		// the search results and look them up
		const cacheKey = `hc:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		// If not in cache, do a search by slug/id
		// Hardcover's API doesn't have a direct "get by ID" endpoint in the public API,
		// so we search by the ID/slug
		const results = await this.search({ title: providerId }, 1);
		const result = results.find((r) => r.providerId === providerId);

		if (result) {
			cache.set(cacheKey, { data: result, timestamp: Date.now() });
		}

		return result || null;
	}

	async isAvailable(): Promise<boolean> {
		return !!this.config.apiKey;
	}

	private mapToResult(doc: HardcoverDocument): BookMetadataResult {
		// Extract ISBNs
		let isbn10: string | undefined;
		let isbn13: string | undefined;
		if (doc.isbns) {
			isbn10 = doc.isbns.find((isbn) => isbn.length === 10);
			isbn13 = doc.isbns.find((isbn) => isbn.length === 13);
		}

		// Extract series info
		let seriesName: string | undefined;
		let seriesNumber: number | undefined;
		let seriesTotal: number | undefined;
		if (doc.featured_series) {
			seriesName = doc.featured_series.series?.name;
			seriesNumber = doc.featured_series.position;
			seriesTotal = doc.featured_series.series?.books_count;
		}

		// Capitalize genres/moods/tags
		const capitalize = (s: string) =>
			s
				.split(' ')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
				.join(' ');

		return {
			provider: 'hardcover',
			providerId: doc.slug || doc.id,
			title: decodeHtmlEntities(doc.title),
			subtitle: decodeHtmlEntities(doc.subtitle),
			authors: doc.author_names ? [...doc.author_names] : undefined,
			description: decodeHtmlEntities(doc.description),
			publishYear: doc.release_year || extractYear(doc.release_date),
			publishedDate: doc.release_date,
			pageCount: doc.pages,
			isbn10,
			isbn13,
			coverUrl: doc.image?.url,
			genres: doc.genres?.map(capitalize),
			moods: doc.moods?.map(capitalize),
			tags: doc.tags?.map(capitalize),
			seriesName,
			seriesNumber,
			seriesTotal,
			rating: doc.rating ? Math.round(doc.rating * 100) / 100 : undefined,
			ratingCount: doc.ratings_count
		};
	}
}
