/**
 * Unified Metadata Provider Types
 * Common interfaces for all book metadata providers
 */

export type MetadataProvider = 'openlibrary' | 'googlebooks' | 'goodreads' | 'hardcover' | 'amazon' | 'comicvine';

export interface BookMetadataResult {
	provider: MetadataProvider;
	providerId?: string; // Provider-specific ID (e.g., Goodreads ID, Google Books ID)

	// Basic info
	title?: string;
	subtitle?: string;
	authors?: string[];
	description?: string;

	// Publication info
	publisher?: string;
	publishedDate?: string; // ISO date string or year
	publishYear?: number;

	// Identifiers
	isbn10?: string;
	isbn13?: string;
	asin?: string;

	// Physical info
	pageCount?: number;
	language?: string;

	// Cover images
	coverUrl?: string;
	thumbnailUrl?: string;

	// Categorization
	genres?: string[];
	subjects?: string[];
	tags?: string[];
	moods?: string[]; // From Hardcover

	// Series info
	seriesName?: string;
	seriesNumber?: number;
	seriesTotal?: number;

	// Ratings
	rating?: number;
	ratingCount?: number;

	// Reviews (optional, from Goodreads)
	reviews?: BookReview[];
}

export interface BookReview {
	reviewerName?: string;
	rating?: number;
	body: string;
	date?: string;
	spoiler?: boolean;
}

export interface MetadataSearchRequest {
	title?: string;
	author?: string;
	isbn?: string;
}

export interface MetadataProviderInterface {
	readonly name: MetadataProvider;
	readonly displayName: string;
	readonly requiresAuth: boolean;

	/**
	 * Search for books and return preview results
	 */
	search(request: MetadataSearchRequest, limit?: number): Promise<BookMetadataResult[]>;

	/**
	 * Fetch detailed metadata for a specific book
	 */
	fetchDetails(providerId: string): Promise<BookMetadataResult | null>;

	/**
	 * Check if provider is available/configured
	 */
	isAvailable(): Promise<boolean>;
}

/**
 * Normalize ISBN by removing hyphens and spaces
 */
export function normalizeIsbn(isbn: string): string {
	return isbn.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Validate ISBN format (10 or 13 digits)
 */
export function isValidIsbn(isbn: string): boolean {
	const normalized = normalizeIsbn(isbn);
	return /^(\d{10}|\d{13}|\d{9}X)$/.test(normalized);
}

/**
 * Extract year from various date formats
 */
export function extractYear(dateStr: string | undefined): number | undefined {
	if (!dateStr) return undefined;
	const match = dateStr.match(/(\d{4})/);
	return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Map language codes to full names
 */
export const languageMap: Record<string, string> = {
	'en': 'English',
	'eng': 'English',
	'es': 'Spanish',
	'spa': 'Spanish',
	'fr': 'French',
	'fra': 'French',
	'de': 'German',
	'deu': 'German',
	'it': 'Italian',
	'ita': 'Italian',
	'pt': 'Portuguese',
	'por': 'Portuguese',
	'ru': 'Russian',
	'rus': 'Russian',
	'ja': 'Japanese',
	'jpn': 'Japanese',
	'zh': 'Chinese',
	'chi': 'Chinese',
	'ko': 'Korean',
	'kor': 'Korean',
	'ar': 'Arabic',
	'ara': 'Arabic',
	'nl': 'Dutch',
	'dut': 'Dutch',
	'sv': 'Swedish',
	'swe': 'Swedish',
	'pl': 'Polish',
	'pol': 'Polish'
};

export function mapLanguageCode(code: string | undefined): string | undefined {
	if (!code) return undefined;
	return languageMap[code.toLowerCase()] || code;
}

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string | null | undefined): string | undefined {
	if (!text || typeof text !== 'string') return undefined;

	const entities: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&apos;': "'",
		'&#39;': "'",
		'&#x27;': "'",
		'&#x2F;': '/',
		'&#x60;': '`',
		'&#x3D;': '=',
		'&nbsp;': ' ',
		'&ndash;': '\u2013',
		'&mdash;': '\u2014',
		'&hellip;': '\u2026',
		'&lsquo;': '\u2018',
		'&rsquo;': '\u2019',
		'&ldquo;': '\u201C',
		'&rdquo;': '\u201D'
	};

	let decoded = text;
	for (const [entity, char] of Object.entries(entities)) {
		decoded = decoded.split(entity).join(char);
	}

	// Handle numeric entities (&#NNN;)
	decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
		return String.fromCharCode(parseInt(dec, 10));
	});

	// Handle hex entities (&#xHHH;)
	decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
		return String.fromCharCode(parseInt(hex, 16));
	});

	return decoded;
}
