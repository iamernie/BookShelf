/**
 * ComicVine Metadata Provider
 * Fetches comic book metadata from ComicVine API
 *
 * Requires an API key from https://comicvine.gamespot.com/api/
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult
} from './types';
import { extractYear } from './types';

const COMICVINE_API_URL = 'https://comicvine.gamespot.com/api';

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
			'Accept': 'application/json',
			'User-Agent': 'BookShelf/2.0 (Book and Comic Metadata Fetcher)'
		}
	});
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string | null | undefined): string | undefined {
	if (!html) return undefined;
	return html.replace(/<[^>]*>/g, '').trim() || undefined;
}

export class ComicVineProvider implements MetadataProviderInterface {
	readonly name = 'comicvine' as const;
	readonly displayName = 'ComicVine';
	readonly requiresAuth = true;

	private apiKey: string | null = null;

	setApiKey(apiKey: string): void {
		this.apiKey = apiKey;
	}

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		if (!this.apiKey) {
			console.warn('ComicVine: API key not configured');
			return [];
		}

		// Build search term
		let searchTerm = '';
		if (request.title) {
			searchTerm = request.title;
		} else if (request.author) {
			searchTerm = request.author;
		}

		if (!searchTerm) {
			return [];
		}

		const cacheKey = `cv:search:${searchTerm}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			// Search both volumes (series) and issues
			const fieldsList = 'api_detail_url,cover_date,description,id,image,issue_number,name,publisher,volume';
			const resources = 'volume,issue';

			const params = new URLSearchParams({
				api_key: this.apiKey,
				format: 'json',
				resources,
				query: searchTerm,
				limit: String(limit),
				field_list: fieldsList
			});

			const url = `${COMICVINE_API_URL}/search/?${params.toString()}`;
			const res = await rateLimitedFetch(url);

			if (!res.ok) {
				console.error(`ComicVine search failed with status ${res.status}`);
				return [];
			}

			const data = await res.json() as ComicVineSearchResponse;

			if (data.error !== 'OK' || !data.results) {
				console.error('ComicVine API error:', data.error);
				return [];
			}

			const results: BookMetadataResult[] = data.results.slice(0, limit).map((comic) => ({
				provider: 'comicvine' as const,
				providerId: String(comic.id),
				title: comic.name || 'Unknown',
				description: stripHtml(comic.description),
				thumbnailUrl: comic.image?.medium_url,
				coverUrl: comic.image?.super_url || comic.image?.original_url,
				seriesName: comic.volume?.name,
				seriesNumber: comic.issue_number ? parseFloat(comic.issue_number) : undefined,
				publishedDate: comic.cover_date,
				publishYear: extractYear(comic.cover_date),
				publisher: comic.publisher?.name
			}));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results;
		} catch (error) {
			console.error('ComicVine search error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		if (!this.apiKey) {
			console.warn('ComicVine: API key not configured');
			return null;
		}

		const cacheKey = `cv:detail:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			// First, try to fetch as an issue
			const issueResult = await this.fetchIssue(providerId);
			if (issueResult) {
				cache.set(cacheKey, { data: issueResult, timestamp: Date.now() });
				return issueResult;
			}

			// If not found as issue, try as volume
			const volumeResult = await this.fetchVolume(providerId);
			if (volumeResult) {
				cache.set(cacheKey, { data: volumeResult, timestamp: Date.now() });
				return volumeResult;
			}

			return null;
		} catch (error) {
			console.error('ComicVine fetch error:', error);
			return null;
		}
	}

	private async fetchIssue(issueId: string): Promise<BookMetadataResult | null> {
		const fieldsList = 'id,name,description,image,issue_number,cover_date,volume,person_credits,publisher';

		const params = new URLSearchParams({
			api_key: this.apiKey!,
			format: 'json',
			field_list: fieldsList
		});

		const url = `${COMICVINE_API_URL}/issue/4000-${issueId}/?${params.toString()}`;
		const res = await rateLimitedFetch(url);

		if (!res.ok) return null;

		const data = await res.json() as ComicVineIssueResponse;
		if (data.error !== 'OK' || !data.results) return null;

		const issue = data.results;

		// Extract authors (writers) from person_credits
		const authors: string[] = [];
		if (issue.person_credits) {
			for (const credit of issue.person_credits) {
				if (credit.role?.toLowerCase().includes('writer')) {
					authors.push(credit.name);
				}
			}
		}

		return {
			provider: 'comicvine',
			providerId: String(issue.id),
			title: issue.name || 'Unknown',
			authors: authors.length > 0 ? authors : undefined,
			description: stripHtml(issue.description),
			coverUrl: issue.image?.super_url || issue.image?.original_url,
			thumbnailUrl: issue.image?.medium_url,
			seriesName: issue.volume?.name,
			seriesNumber: issue.issue_number ? parseFloat(issue.issue_number) : undefined,
			publishedDate: issue.cover_date,
			publishYear: extractYear(issue.cover_date)
		};
	}

	private async fetchVolume(volumeId: string): Promise<BookMetadataResult | null> {
		const fieldsList = 'id,name,description,image,start_year,count_of_issues,publisher';

		const params = new URLSearchParams({
			api_key: this.apiKey!,
			format: 'json',
			field_list: fieldsList
		});

		const url = `${COMICVINE_API_URL}/volume/4050-${volumeId}/?${params.toString()}`;
		const res = await rateLimitedFetch(url);

		if (!res.ok) return null;

		const data = await res.json() as ComicVineVolumeResponse;
		if (data.error !== 'OK' || !data.results) return null;

		const volume = data.results;

		return {
			provider: 'comicvine',
			providerId: String(volume.id),
			title: volume.name || 'Unknown',
			description: stripHtml(volume.description),
			coverUrl: volume.image?.super_url || volume.image?.original_url,
			thumbnailUrl: volume.image?.medium_url,
			seriesName: volume.name,
			seriesTotal: volume.count_of_issues,
			publishYear: volume.start_year ? parseInt(volume.start_year, 10) : undefined,
			publisher: volume.publisher?.name
		};
	}

	async isAvailable(): Promise<boolean> {
		return !!this.apiKey;
	}
}

// Type definitions for ComicVine API responses
interface ComicVineImage {
	icon_url?: string;
	medium_url?: string;
	screen_url?: string;
	screen_large_url?: string;
	small_url?: string;
	super_url?: string;
	thumb_url?: string;
	tiny_url?: string;
	original_url?: string;
}

interface ComicVineVolume {
	api_detail_url?: string;
	id?: number;
	name?: string;
	site_detail_url?: string;
}

interface ComicVinePublisher {
	api_detail_url?: string;
	id?: number;
	name?: string;
}

interface ComicVinePersonCredit {
	api_detail_url?: string;
	id?: number;
	name: string;
	role?: string;
	site_detail_url?: string;
}

interface ComicVineSearchResult {
	api_detail_url?: string;
	cover_date?: string;
	description?: string;
	id: number;
	image?: ComicVineImage;
	issue_number?: string;
	name?: string;
	publisher?: ComicVinePublisher;
	volume?: ComicVineVolume;
}

interface ComicVineSearchResponse {
	error: string;
	limit: number;
	offset: number;
	number_of_page_results: number;
	number_of_total_results: number;
	status_code: number;
	results?: ComicVineSearchResult[];
	version: string;
}

interface ComicVineIssueDetails {
	id: number;
	name?: string;
	description?: string;
	image?: ComicVineImage;
	issue_number?: string;
	cover_date?: string;
	volume?: ComicVineVolume;
	person_credits?: ComicVinePersonCredit[];
	publisher?: ComicVinePublisher;
}

interface ComicVineIssueResponse {
	error: string;
	limit: number;
	offset: number;
	number_of_page_results: number;
	number_of_total_results: number;
	status_code: number;
	results?: ComicVineIssueDetails;
	version: string;
}

interface ComicVineVolumeDetails {
	id: number;
	name?: string;
	description?: string;
	image?: ComicVineImage;
	start_year?: string;
	count_of_issues?: number;
	publisher?: ComicVinePublisher;
}

interface ComicVineVolumeResponse {
	error: string;
	limit: number;
	offset: number;
	number_of_page_results: number;
	number_of_total_results: number;
	status_code: number;
	results?: ComicVineVolumeDetails;
	version: string;
}
