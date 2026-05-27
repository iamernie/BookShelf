/**
 * Audible Metadata Provider
 * Uses the public Audible API (no auth required)
 * Excellent for audiobook-specific metadata including narrators
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	MetadataSearchResponse,
	BookMetadataResult
} from './types';
import {
	extractYear,
	mapLanguageCode,
	decodeHtmlEntities,
	stripHtmlTags
} from './types';

const AUDIBLE_API_URL = 'https://api.audible.com/1.0/catalog/products';

// Browser-like user agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

interface AudibleAuthor {
	asin?: string;
	name: string;
}

interface AudibleNarrator {
	name: string;
}

interface AudibleSeries {
	asin?: string;
	title: string;
	sequence?: string;
}

interface AudibleRating {
	overall_distribution?: {
		display_average_rating?: number;
		num_ratings?: number;
	};
	performance_distribution?: {
		display_average_rating?: number;
	};
	story_distribution?: {
		display_average_rating?: number;
	};
}

interface AudibleProduct {
	asin: string;
	title: string;
	subtitle?: string;
	authors?: AudibleAuthor[];
	narrators?: AudibleNarrator[];
	series?: AudibleSeries[];
	runtime_length_min?: number;
	release_date?: string;
	publisher_name?: string;
	language?: string;
	format_type?: string;
	merchandising_summary?: string;
	publisher_summary?: string;
	product_images?: {
		'500'?: string;
		'1024'?: string;
	};
	rating?: AudibleRating;
	category_ladders?: Array<{
		ladder: Array<{
			id: string;
			name: string;
		}>;
	}>;
}

interface AudibleSearchResponse {
	products?: AudibleProduct[];
	total_results?: number;
}

export class AudibleProvider implements MetadataProviderInterface {
	readonly name = 'audible' as const;
	readonly displayName = 'Audible';
	readonly requiresAuth = false;

	private domain: string = 'com';

	setDomain(domain: string): void {
		this.domain = domain;
	}

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		const response = await this.searchWithStatus(request, limit);
		return response.results;
	}

	async searchWithStatus(request: MetadataSearchRequest, limit = 10): Promise<MetadataSearchResponse> {
		// Build search query
		const params = new URLSearchParams();

		if (request.title) {
			params.set('title', request.title);
		}
		if (request.author) {
			params.set('author', request.author);
		}

		// If no title or author, we can't search
		if (!request.title && !request.author) {
			return { results: [] };
		}

		params.set('num_results', String(Math.min(limit, 50)));
		params.set('response_groups', 'product_desc,contributors,product_attrs,media,series,rating,category_ladders');

		const cacheKey = `audible:${params.toString()}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return { results: cached.data as BookMetadataResult[] };
		}

		try {
			const url = `${AUDIBLE_API_URL}?${params.toString()}`;
			const res = await fetch(url, {
				headers: {
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.9',
					'User-Agent': USER_AGENT
				}
			});

			if (!res.ok) {
				if (res.status === 429) {
					console.error('Audible API: Rate limit exceeded (429)');
					return {
						results: [],
						error: 'Audible API rate limit exceeded. Please try again later.',
						errorCode: 'RATE_LIMITED'
					};
				}

				if (res.status === 503) {
					console.error('Audible API: Service unavailable (503)');
					return {
						results: [],
						error: 'Audible API is temporarily unavailable.',
						errorCode: 'NETWORK_ERROR'
					};
				}

				console.error(`Audible API error: ${res.status}`);
				return {
					results: [],
					error: `Audible API error (${res.status})`,
					errorCode: 'NETWORK_ERROR'
				};
			}

			const data: AudibleSearchResponse = await res.json();

			if (!data.products || data.products.length === 0) {
				return { results: [] };
			}

			const results = data.products.map((product) => this.mapToResult(product));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return { results };
		} catch (error) {
			console.error('Audible search error:', error);
			return {
				results: [],
				error: 'Failed to connect to Audible API',
				errorCode: 'NETWORK_ERROR'
			};
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		const cacheKey = `audible:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const params = new URLSearchParams();
			params.set('response_groups', 'product_desc,contributors,product_attrs,media,series,rating,category_ladders');

			const url = `${AUDIBLE_API_URL}/${providerId}?${params.toString()}`;
			const res = await fetch(url, {
				headers: {
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.9',
					'User-Agent': USER_AGENT
				}
			});

			if (!res.ok) return null;

			const data = await res.json();
			const product = data.product as AudibleProduct;

			if (!product) return null;

			const result = this.mapToResult(product);

			cache.set(cacheKey, { data: result, timestamp: Date.now() });
			return result;
		} catch (error) {
			console.error('Audible fetch error:', error);
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		return true; // Audible API is always available
	}

	private mapToResult(product: AudibleProduct): BookMetadataResult {
		// Get best cover image
		let coverUrl: string | undefined;
		let thumbnailUrl: string | undefined;

		if (product.product_images) {
			coverUrl = product.product_images['1024'] || product.product_images['500'];
			thumbnailUrl = product.product_images['500'];
		}

		// Extract authors
		const authors = product.authors?.map((a) => a.name) || [];

		// Extract narrators
		const narrators = product.narrators?.map((n) => n.name) || [];

		// Extract series info (take first series if multiple)
		let seriesName: string | undefined;
		let seriesNumber: number | undefined;
		if (product.series && product.series.length > 0) {
			const firstSeries = product.series[0];
			seriesName = firstSeries.title;
			if (firstSeries.sequence) {
				const num = parseFloat(firstSeries.sequence);
				if (!isNaN(num)) {
					seriesNumber = num;
				}
			}
		}

		// Extract genres from category ladders
		const genres: string[] = [];
		if (product.category_ladders) {
			for (const ladder of product.category_ladders) {
				for (const category of ladder.ladder) {
					if (category.name && !genres.includes(category.name)) {
						genres.push(category.name);
					}
				}
			}
		}

		// Get rating
		let rating: number | undefined;
		let ratingCount: number | undefined;
		if (product.rating?.overall_distribution) {
			rating = product.rating.overall_distribution.display_average_rating;
			ratingCount = product.rating.overall_distribution.num_ratings;
		}

		// Get description (prefer merchandising_summary, fall back to publisher_summary)
		let description = product.merchandising_summary || product.publisher_summary;
		if (description) {
			description = stripHtmlTags(decodeHtmlEntities(description));
		}

		// Convert runtime to page count equivalent (rough estimate: 1 min = 1 "page" for sorting)
		// This is stored separately as we might want to track actual runtime later
		const pageCount = product.runtime_length_min;

		return {
			provider: 'audible',
			providerId: product.asin,
			title: decodeHtmlEntities(product.title),
			subtitle: decodeHtmlEntities(product.subtitle),
			authors,
			narrators,
			description,
			publisher: product.publisher_name,
			publishedDate: product.release_date,
			publishYear: extractYear(product.release_date),
			pageCount, // Using runtime in minutes
			language: mapLanguageCode(product.language),
			asin: product.asin,
			coverUrl,
			thumbnailUrl,
			genres,
			seriesName,
			seriesNumber,
			rating,
			ratingCount
		};
	}
}
