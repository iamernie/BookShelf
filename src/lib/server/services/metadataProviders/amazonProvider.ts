/**
 * Amazon Metadata Provider
 * Scrapes book data from Amazon search and product pages
 *
 * Based on BookLore's AmazonBookParser approach:
 * - Search returns book previews from search results page
 * - Details are extracted from product page HTML
 */

import type {
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult
} from './types';
import { decodeHtmlEntities } from './types';

// Supported Amazon domains
type AmazonDomain = 'com' | 'co.uk' | 'de' | 'fr' | 'it' | 'es' | 'ca' | 'com.au' | 'co.jp' | 'in';

interface LocaleInfo {
	acceptLanguage: string;
	locale: string;
}

const DOMAIN_LOCALE_MAP: Record<string, LocaleInfo> = {
	'com': { acceptLanguage: 'en-US,en;q=0.9', locale: 'en-US' },
	'co.uk': { acceptLanguage: 'en-GB,en;q=0.9', locale: 'en-GB' },
	'de': { acceptLanguage: 'en-GB,en;q=0.9,de;q=0.8', locale: 'de-DE' },
	'fr': { acceptLanguage: 'en-GB,en;q=0.9,fr;q=0.8', locale: 'fr-FR' },
	'it': { acceptLanguage: 'en-GB,en;q=0.9,it;q=0.8', locale: 'it-IT' },
	'es': { acceptLanguage: 'en-GB,en;q=0.9,es;q=0.8', locale: 'es-ES' },
	'ca': { acceptLanguage: 'en-US,en;q=0.9', locale: 'en-CA' },
	'com.au': { acceptLanguage: 'en-GB,en;q=0.9', locale: 'en-AU' },
	'co.jp': { acceptLanguage: 'en-GB,en;q=0.9,ja;q=0.8', locale: 'ja-JP' },
	'in': { acceptLanguage: 'en-GB,en;q=0.9', locale: 'en-IN' }
};

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

// Rate limiting - 2 seconds between requests (Amazon is stricter)
let lastRequestTime = 0;
const RATE_LIMIT_MS = 2000;

async function rateLimitedFetch(url: string, domain: AmazonDomain = 'com'): Promise<Response> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < RATE_LIMIT_MS) {
		await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
	}
	lastRequestTime = Date.now();

	const localeInfo = DOMAIN_LOCALE_MAP[domain] || DOMAIN_LOCALE_MAP['com'];

	return fetch(url, {
		headers: {
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': localeInfo.acceptLanguage,
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
			'Sec-Ch-Ua-Mobile': '?0',
			'Sec-Ch-Ua-Platform': '"macOS"',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'none',
			'Upgrade-Insecure-Requests': '1'
		}
	});
}

/**
 * Extract text using regex patterns (fallback approach without DOM parser)
 */
function extractText(html: string, patterns: RegExp[]): string | undefined {
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match && match[1]) {
			return decodeHtmlEntities(match[1].trim());
		}
	}
	return undefined;
}

/**
 * Clean HTML tags from text
 */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parse search results from Amazon search page HTML
 */
function parseSearchResults(html: string): AmazonSearchResult[] {
	const results: AmazonSearchResult[] = [];

	// Find search result items
	const itemPattern = /<div[^>]*data-asin="([A-Z0-9]{10})"[^>]*data-index="\d+"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
	let match;

	while ((match = itemPattern.exec(html)) !== null) {
		const asin = match[1];
		const itemHtml = match[2];

		// Skip box sets and collections
		if (itemHtml.toLowerCase().includes('box set') ||
			itemHtml.toLowerCase().includes('collection set') ||
			itemHtml.includes('Collects books from')) {
			continue;
		}

		// Extract title - look for data-cy="title-recipe" or h2 with link
		const titlePatterns = [
			/<h2[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
			/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<\/span>/i
		];
		const title = extractText(itemHtml, titlePatterns);
		if (!title) continue;

		// Extract author
		const authorPatterns = [
			/<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*a-size-base[^"]*"[^>]*>([^<]+)<\/span>/i,
			/by\s+<a[^>]*>([^<]+)<\/a>/i
		];
		const author = extractText(itemHtml, authorPatterns);

		// Extract cover image
		const coverPatterns = [
			/<img[^>]*src="(https:\/\/m\.media-amazon\.com[^"]+)"/i,
			/<img[^>]*data-src="(https:\/\/m\.media-amazon\.com[^"]+)"/i
		];
		const coverUrl = extractText(itemHtml, coverPatterns);

		results.push({
			asin,
			title: stripHtml(title),
			author: author ? stripHtml(author) : undefined,
			coverUrl
		});
	}

	// Fallback: simpler pattern for newer Amazon layouts
	if (results.length === 0) {
		const simplePattern = /data-asin="([A-Z0-9]{10})"/g;
		const asins: string[] = [];
		let simpleMatch;
		while ((simpleMatch = simplePattern.exec(html)) !== null) {
			if (!asins.includes(simpleMatch[1]) && simpleMatch[1].length === 10) {
				asins.push(simpleMatch[1]);
			}
		}

		// For each ASIN, try to find associated title
		for (const asin of asins.slice(0, 10)) {
			// Look for title near this ASIN
			const asinIndex = html.indexOf(`data-asin="${asin}"`);
			if (asinIndex > -1) {
				const nearbyHtml = html.substring(asinIndex, asinIndex + 2000);
				const titleMatch = nearbyHtml.match(/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<\/span>/i);
				if (titleMatch) {
					results.push({
						asin,
						title: stripHtml(titleMatch[1]),
						author: undefined,
						coverUrl: undefined
					});
				}
			}
		}
	}

	return results;
}

/**
 * Parse book details from Amazon product page
 */
function parseBookDetails(html: string, asin: string): BookMetadataResult | null {
	// Extract title
	const titlePatterns = [
		/<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i,
		/<span[^>]*id="ebooksProductTitle"[^>]*>([^<]+)<\/span>/i,
		/<h1[^>]*id="title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i
	];
	const fullTitle = extractText(html, titlePatterns);
	if (!fullTitle) return null;

	// Split title and subtitle
	const [title, subtitle] = fullTitle.includes(':')
		? fullTitle.split(':', 2).map(s => s.trim())
		: [fullTitle, undefined];

	// Extract authors
	const authors: string[] = [];
	const authorPattern = /<a[^>]*class="[^"]*author[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;
	let authorMatch;
	while ((authorMatch = authorPattern.exec(html)) !== null) {
		const name = stripHtml(authorMatch[1]);
		if (name && !authors.includes(name)) {
			authors.push(name);
		}
	}

	// Fallback author extraction
	if (authors.length === 0) {
		const simpleAuthorPattern = /<span[^>]*class="author[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
		while ((authorMatch = simpleAuthorPattern.exec(html)) !== null) {
			const name = stripHtml(authorMatch[1]);
			if (name && !authors.includes(name)) {
				authors.push(name);
			}
		}
	}

	// Extract description
	const descPatterns = [
		/<div[^>]*data-a-expander-name="book_description_expander"[^>]*>[\s\S]*?<div[^>]*class="[^"]*a-expander-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
		/<div[^>]*id="bookDescription_feature_div"[^>]*>[\s\S]*?<noscript>([\s\S]*?)<\/noscript>/i
	];
	let description = extractText(html, descPatterns);
	if (description) {
		// Clean up HTML in description
		description = description
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			.trim();
	}

	// Extract cover image
	const coverPatterns = [
		/<img[^>]*id="landingImage"[^>]*data-old-hires="([^"]+)"/i,
		/<img[^>]*id="landingImage"[^>]*src="([^"]+)"/i,
		/<img[^>]*id="imgBlkFront"[^>]*src="([^"]+)"/i
	];
	const coverUrl = extractText(html, coverPatterns);

	// Extract ISBN-10
	const isbn10Patterns = [
		/<span[^>]*id="rpi-attribute-book_details-isbn10"[^>]*>[\s\S]*?<span[^>]*class="[^"]*rpi-attribute-value[^"]*"[^>]*>[\s\S]*?<span[^>]*>([0-9X]+)<\/span>/i,
		/ISBN-10\s*:?\s*<\/span>\s*<span[^>]*>([0-9X]+)<\/span>/i
	];
	const isbn10 = extractText(html, isbn10Patterns)?.replace(/[^0-9X]/gi, '');

	// Extract ISBN-13
	const isbn13Patterns = [
		/<span[^>]*id="rpi-attribute-book_details-isbn13"[^>]*>[\s\S]*?<span[^>]*class="[^"]*rpi-attribute-value[^"]*"[^>]*>[\s\S]*?<span[^>]*>([0-9-]+)<\/span>/i,
		/ISBN-13\s*:?\s*<\/span>\s*<span[^>]*>([0-9-]+)<\/span>/i
	];
	const isbn13 = extractText(html, isbn13Patterns)?.replace(/[^0-9]/g, '');

	// Extract publisher
	const publisherPatterns = [
		/Publisher\s*:?\s*<\/span>\s*<span[^>]*>([^<(]+)/i,
		/<span[^>]*>Publisher<\/span>\s*<span[^>]*>([^<(]+)/i
	];
	let publisher = extractText(html, publisherPatterns);
	if (publisher) {
		publisher = publisher.split(';')[0].trim();
	}

	// Extract page count
	const pagePatterns = [
		/<span[^>]*id="rpi-attribute-book_details-fiona_pages"[^>]*>[\s\S]*?<span[^>]*>(\d+)/i,
		/(\d+)\s*pages/i
	];
	const pageCountStr = extractText(html, pagePatterns);
	const pageCount = pageCountStr ? parseInt(pageCountStr.replace(/\D/g, ''), 10) : undefined;

	// Extract language
	const langPatterns = [
		/<span[^>]*id="rpi-attribute-language"[^>]*>[\s\S]*?<span[^>]*class="[^"]*rpi-attribute-value[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
		/Language\s*:?\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i
	];
	const language = extractText(html, langPatterns);

	// Extract series info
	const seriesPatterns = [
		/<span[^>]*id="rpi-attribute-book_details-series"[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i
	];
	const seriesName = extractText(html, seriesPatterns);

	let seriesNumber: number | undefined;
	const seriesNumPatterns = [
		/Book\s+(\d+(?:\.\d+)?)\s+of\s+\d+/i
	];
	const seriesNumStr = extractText(html, seriesNumPatterns);
	if (seriesNumStr) {
		seriesNumber = parseFloat(seriesNumStr);
	}

	// Extract rating
	const ratingPatterns = [
		/<span[^>]*id="acrPopover"[^>]*>[\s\S]*?<span[^>]*class="[^"]*a-size-base[^"]*"[^>]*>([0-9.,]+)/i,
		/<span[^>]*class="[^"]*a-icon-alt[^"]*"[^>]*>([0-9.,]+)\s*out\s*of/i
	];
	const ratingStr = extractText(html, ratingPatterns);
	const rating = ratingStr ? parseFloat(ratingStr.replace(',', '.')) : undefined;

	// Extract rating count
	const ratingCountPatterns = [
		/<span[^>]*id="acrCustomerReviewText"[^>]*>([0-9,]+)/i
	];
	const ratingCountStr = extractText(html, ratingCountPatterns);
	const ratingCount = ratingCountStr ? parseInt(ratingCountStr.replace(/\D/g, ''), 10) : undefined;

	// Extract categories/genres
	const genres: string[] = [];
	const categoryPattern = /<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*href="[^"]*\/b\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
	let catMatch;
	while ((catMatch = categoryPattern.exec(html)) !== null) {
		const genre = stripHtml(catMatch[1]).replace(/\(Books\)/i, '').trim();
		if (genre && !genres.includes(genre) && genre.length > 2) {
			genres.push(genre);
		}
	}

	return {
		provider: 'amazon',
		providerId: asin,
		asin,
		title,
		subtitle,
		authors: authors.length > 0 ? authors : undefined,
		description,
		publisher,
		pageCount,
		language,
		isbn10,
		isbn13,
		coverUrl,
		genres: genres.length > 0 ? genres : undefined,
		seriesName,
		seriesNumber,
		rating,
		ratingCount
	};
}

export class AmazonProvider implements MetadataProviderInterface {
	readonly name = 'amazon' as const;
	readonly displayName = 'Amazon';
	readonly requiresAuth = false;

	private domain: AmazonDomain = 'com';

	setDomain(domain: AmazonDomain): void {
		this.domain = domain;
	}

	async search(request: MetadataSearchRequest, limit = 10): Promise<BookMetadataResult[]> {
		// Build search query
		let searchTerm = '';
		if (request.isbn) {
			searchTerm = request.isbn.replace(/[-\s]/g, '');
		} else {
			const parts: string[] = [];
			if (request.title) {
				// Clean title - remove special characters
				const cleanTitle = request.title.replace(/[^\p{L}\p{M}0-9\s]/gu, ' ').trim();
				parts.push(cleanTitle);
			}
			if (request.author) {
				const cleanAuthor = request.author.replace(/[^\p{L}\p{M}0-9\s]/gu, ' ').trim();
				parts.push(cleanAuthor);
			}
			searchTerm = parts.join(' ');
		}

		if (!searchTerm) {
			return [];
		}

		const cacheKey = `amz:search:${this.domain}:${searchTerm}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult[];
		}

		try {
			const encodedSearch = encodeURIComponent(searchTerm).replace(/%20/g, '+');
			const url = `https://www.amazon.${this.domain}/s?k=${encodedSearch}&i=stripbooks`;

			const res = await rateLimitedFetch(url, this.domain);
			if (!res.ok) {
				console.error(`Amazon search failed with status ${res.status}`);
				return [];
			}

			const html = await res.text();
			const searchResults = parseSearchResults(html);

			// Convert to BookMetadataResult
			const results: BookMetadataResult[] = searchResults.slice(0, limit).map((r) => ({
				provider: 'amazon' as const,
				providerId: r.asin,
				asin: r.asin,
				title: r.title,
				authors: r.author ? [r.author] : undefined,
				thumbnailUrl: r.coverUrl
			}));

			cache.set(cacheKey, { data: results, timestamp: Date.now() });
			return results;
		} catch (error) {
			console.error('Amazon search error:', error);
			return [];
		}
	}

	async fetchDetails(providerId: string): Promise<BookMetadataResult | null> {
		const cacheKey = `amz:detail:${this.domain}:${providerId}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.data as BookMetadataResult;
		}

		try {
			const url = `https://www.amazon.${this.domain}/dp/${providerId}`;
			const res = await rateLimitedFetch(url, this.domain);

			if (!res.ok) {
				console.error(`Amazon fetch failed with status ${res.status}`);
				return null;
			}

			const html = await res.text();
			const result = parseBookDetails(html, providerId);

			if (result) {
				cache.set(cacheKey, { data: result, timestamp: Date.now() });
			}
			return result;
		} catch (error) {
			console.error('Amazon fetch error:', error);
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		return true;
	}
}

interface AmazonSearchResult {
	asin: string;
	title: string;
	author?: string;
	coverUrl?: string;
}
