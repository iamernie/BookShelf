/**
 * Book Lookup Service
 * Fetches book metadata from Open Library and Google Books APIs
 * Enhanced with caching, HTML entity decoding, and name search
 * Ported from BookShelfV1
 */

// Simple in-memory cache (15 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

export interface BookLookupResult {
	title?: string;
	authors?: string[];
	publisher?: string;
	publishYear?: number;
	pageCount?: number;
	language?: string;
	summary?: string;
	isbn13?: string;
	isbn10?: string;
	googleBooksId?: string;
	coverUrl?: string;
	googleCoverUrl?: string;
	subjects?: string[];
	source: 'openlibrary' | 'googlebooks';
}

export interface BookSearchResult extends BookLookupResult {
	key?: string;
	isEnglish: boolean;
}

export interface LookupError {
	error: string;
}

/**
 * Normalize ISBN (remove hyphens and spaces)
 */
export function normalizeIsbn(isbn: string): string {
	return isbn.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Validate ISBN format
 */
export function isValidIsbn(isbn: string): boolean {
	const normalized = normalizeIsbn(isbn);
	return /^(\d{10}|\d{13}|\d{9}X)$/.test(normalized);
}

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string | null | undefined): string | undefined {
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

/**
 * Map language codes to full names
 */
const languageMap: Record<string, string> = {
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

function mapLanguageCode(code: string | undefined): string | undefined {
	if (!code) return undefined;
	return languageMap[code.toLowerCase()] || code;
}

/**
 * Look up book by ISBN using Open Library API
 */
async function lookupOpenLibraryByIsbn(isbn: string): Promise<BookLookupResult | null> {
	const cleanIsbn = normalizeIsbn(isbn);
	const cacheKey = `ol:${cleanIsbn}`;

	// Check cache
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as BookLookupResult;
	}

	try {
		const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);

		if (!res.ok) return null;

		const data = await res.json();
		const bookData = data[`ISBN:${cleanIsbn}`];

		if (!bookData) return null;

		// Get cover URL - prefer larger sizes
		let coverUrl: string | undefined;
		if (bookData.cover) {
			coverUrl = bookData.cover.large || bookData.cover.medium || bookData.cover.small;
		}

		// Extract year from publish date
		let publishYear: number | undefined;
		if (bookData.publish_date) {
			const yearMatch = bookData.publish_date.match(/\d{4}/);
			if (yearMatch) {
				publishYear = parseInt(yearMatch[0]);
			}
		}

		const result: BookLookupResult = {
			title: decodeHtmlEntities(bookData.title),
			authors: bookData.authors?.map((a: { name: string }) => a.name),
			publisher: bookData.publishers?.[0]?.name,
			publishYear,
			pageCount: bookData.number_of_pages,
			language: mapLanguageCode(bookData.languages?.[0]?.key?.split('/').pop()),
			summary: decodeHtmlEntities(bookData.notes),
			subjects: bookData.subjects?.slice(0, 5).map((s: { name: string }) => s.name),
			coverUrl,
			isbn13: cleanIsbn.length === 13 ? cleanIsbn : undefined,
			isbn10: cleanIsbn.length === 10 ? cleanIsbn : undefined,
			source: 'openlibrary'
		};

		// Cache the result
		cache.set(cacheKey, { data: result, timestamp: Date.now() });
		return result;
	} catch (error) {
		console.error('Open Library lookup error:', error);
		return null;
	}
}

/**
 * Look up book by ISBN using Google Books API
 */
async function lookupGoogleBooksByIsbn(isbn: string): Promise<BookLookupResult | null> {
	const cleanIsbn = normalizeIsbn(isbn);
	const cacheKey = `gb:${cleanIsbn}`;

	// Check cache
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as BookLookupResult;
	}

	try {
		const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);

		if (!res.ok) return null;

		const data = await res.json();

		if (!data.items || data.items.length === 0) return null;

		const book = data.items[0].volumeInfo;

		// Get best cover image
		let coverUrl: string | undefined;
		if (book.imageLinks) {
			coverUrl = book.imageLinks.extraLarge ||
				book.imageLinks.large ||
				book.imageLinks.medium ||
				book.imageLinks.thumbnail;

			// Convert to https and get higher quality
			if (coverUrl) {
				coverUrl = coverUrl.replace('http://', 'https://');
				coverUrl = coverUrl.replace('&zoom=1', '&zoom=2');
				coverUrl = coverUrl.replace('&edge=curl', '');
			}
		}

		// Extract ISBN identifiers
		let isbn13: string | undefined;
		let isbn10: string | undefined;
		if (book.industryIdentifiers) {
			for (const id of book.industryIdentifiers) {
				if (id.type === 'ISBN_13') isbn13 = id.identifier;
				if (id.type === 'ISBN_10') isbn10 = id.identifier;
			}
		}

		// Extract year from published date
		let publishYear: number | undefined;
		if (book.publishedDate) {
			const yearMatch = book.publishedDate.match(/\d{4}/);
			if (yearMatch) {
				publishYear = parseInt(yearMatch[0]);
			}
		}

		const result: BookLookupResult = {
			title: decodeHtmlEntities(book.title),
			authors: book.authors,
			publisher: book.publisher,
			publishYear,
			pageCount: book.pageCount,
			language: mapLanguageCode(book.language),
			summary: decodeHtmlEntities(book.description),
			subjects: book.categories || [],
			isbn13,
			isbn10,
			googleBooksId: data.items[0].id,
			coverUrl,
			source: 'googlebooks'
		};

		// Cache the result
		cache.set(cacheKey, { data: result, timestamp: Date.now() });
		return result;
	} catch (error) {
		console.error('Google Books lookup error:', error);
		return null;
	}
}

/**
 * Search by title and author using Open Library - returns multiple results
 */
async function searchOpenLibraryByName(query: string, limit = 10): Promise<BookSearchResult[]> {
	const cacheKey = `ol-search:${query.toLowerCase()}`;

	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as BookSearchResult[];
	}

	try {
		const encoded = encodeURIComponent(query);
		const requestLimit = Math.min(limit * 2, 40);
		const res = await fetch(
			`https://openlibrary.org/search.json?q=${encoded}&limit=${requestLimit}&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median,subject,language`
		);

		if (!res.ok) return [];

		const data = await res.json();

		if (!data.docs || data.docs.length === 0) return [];

		const results: BookSearchResult[] = data.docs.map((book: {
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
		}) => {
			const languages = book.language || [];
			const isEnglish = languages.includes('eng') || languages.includes('en');
			const primaryLang = languages.length > 0 ? mapLanguageCode(languages[0]) : undefined;

			return {
				key: book.key,
				title: decodeHtmlEntities(book.title),
				authors: book.author_name || [],
				publisher: book.publisher?.[0],
				publishYear: book.first_publish_year,
				pageCount: book.number_of_pages_median,
				language: primaryLang,
				subjects: book.subject?.slice(0, 5) || [],
				isbn13: book.isbn?.find((i: string) => i.length === 13),
				isbn10: book.isbn?.find((i: string) => i.length === 10),
				coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
				source: 'openlibrary' as const,
				isEnglish
			};
		});

		cache.set(cacheKey, { data: results, timestamp: Date.now() });
		return results;
	} catch (error) {
		console.error('Open Library search error:', error);
		return [];
	}
}

/**
 * Search by title and author using Google Books - returns multiple results
 */
async function searchGoogleBooksByName(query: string, limit = 10): Promise<BookSearchResult[]> {
	const cacheKey = `gb-search:${query.toLowerCase()}`;

	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as BookSearchResult[];
	}

	try {
		const encoded = encodeURIComponent(query);
		const requestLimit = Math.min(limit * 2, 40);
		const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=${requestLimit}`);

		if (!res.ok) return [];

		const data = await res.json();

		if (!data.items || data.items.length === 0) return [];

		const results: BookSearchResult[] = data.items.map((item: {
			id: string;
			volumeInfo: {
				title?: string;
				authors?: string[];
				publisher?: string;
				publishedDate?: string;
				pageCount?: number;
				language?: string;
				description?: string;
				categories?: string[];
				industryIdentifiers?: { type: string; identifier: string }[];
				imageLinks?: { thumbnail?: string };
			};
		}) => {
			const book = item.volumeInfo;
			const langCode = book.language || '';
			const isEnglish = langCode === 'en' || langCode === 'eng';

			let coverUrl: string | undefined;
			if (book.imageLinks?.thumbnail) {
				coverUrl = book.imageLinks.thumbnail.replace('http://', 'https://');
			}

			let isbn13: string | undefined;
			let isbn10: string | undefined;
			if (book.industryIdentifiers) {
				for (const id of book.industryIdentifiers) {
					if (id.type === 'ISBN_13') isbn13 = id.identifier;
					if (id.type === 'ISBN_10') isbn10 = id.identifier;
				}
			}

			let publishYear: number | undefined;
			if (book.publishedDate) {
				const yearMatch = book.publishedDate.match(/\d{4}/);
				if (yearMatch) {
					publishYear = parseInt(yearMatch[0]);
				}
			}

			return {
				key: item.id,
				googleBooksId: item.id,
				title: decodeHtmlEntities(book.title),
				authors: book.authors || [],
				publisher: book.publisher,
				publishYear,
				pageCount: book.pageCount,
				language: mapLanguageCode(langCode),
				summary: decodeHtmlEntities(book.description),
				subjects: book.categories || [],
				isbn13,
				isbn10,
				coverUrl,
				source: 'googlebooks' as const,
				isEnglish
			};
		});

		cache.set(cacheKey, { data: results, timestamp: Date.now() });
		return results;
	} catch (error) {
		console.error('Google Books search error:', error);
		return [];
	}
}

/**
 * Look up book by ISBN (tries both sources)
 */
export async function lookupByIsbn(isbn: string): Promise<BookLookupResult | LookupError> {
	if (!isValidIsbn(isbn)) {
		return { error: 'Invalid ISBN format. Please enter a 10 or 13 digit ISBN.' };
	}

	// Try both sources in parallel
	const [openLibrary, googleBooks] = await Promise.all([
		lookupOpenLibraryByIsbn(isbn),
		lookupGoogleBooksByIsbn(isbn)
	]);

	// Prefer Google Books for more complete data, fall back to Open Library
	if (googleBooks) {
		// Merge cover from Open Library if Google doesn't have one
		if (!googleBooks.coverUrl && openLibrary?.coverUrl) {
			googleBooks.coverUrl = openLibrary.coverUrl;
		}
		// Add Open Library cover as alternative
		if (openLibrary?.coverUrl && googleBooks.coverUrl !== openLibrary.coverUrl) {
			googleBooks.googleCoverUrl = googleBooks.coverUrl;
		}
		return googleBooks;
	}

	if (openLibrary) {
		return openLibrary;
	}

	return { error: 'Book not found. Try a different ISBN or enter details manually.' };
}

/**
 * Search books by title/author - returns multiple results with English prioritized
 */
export async function searchByName(
	query: string,
	maxResults = 10,
	source: 'both' | 'openlibrary' | 'googlebooks' = 'both'
): Promise<BookSearchResult[] | LookupError> {
	if (!query || query.trim().length < 2) {
		return { error: 'Please enter at least 2 characters to search.' };
	}

	const allResults: BookSearchResult[] = [];
	const seenKeys = new Set<string>();

	// Search Open Library if requested
	if (source === 'both' || source === 'openlibrary') {
		try {
			const olResults = await searchOpenLibraryByName(query, maxResults);
			for (const book of olResults) {
				const key = `${book.title?.toLowerCase()}-${book.authors?.join(',').toLowerCase()}`;
				if (!seenKeys.has(key)) {
					seenKeys.add(key);
					allResults.push(book);
				}
			}
		} catch (e) {
			console.log('Open Library name search failed:', e);
		}
	}

	// Search Google Books if requested
	if (source === 'both' || source === 'googlebooks') {
		try {
			const gbResults = await searchGoogleBooksByName(query, maxResults);
			for (const book of gbResults) {
				const key = `${book.title?.toLowerCase()}-${book.authors?.join(',').toLowerCase()}`;
				if (!seenKeys.has(key)) {
					seenKeys.add(key);
					allResults.push(book);
				}
			}
		} catch (e) {
			console.log('Google Books name search failed:', e);
		}
	}

	if (allResults.length === 0) {
		return { error: 'No books found. Try a different search term.' };
	}

	// Sort results: English books first, then others
	const englishBooks = allResults.filter(b => b.isEnglish);
	const otherBooks = allResults.filter(b => !b.isEnglish);

	return [...englishBooks, ...otherBooks].slice(0, maxResults);
}

/**
 * Get full details for a book from search results
 */
export async function getBookDetails(book: BookSearchResult): Promise<BookLookupResult | LookupError> {
	// If we have an ISBN, use the full ISBN lookup for complete data
	if (book.isbn13 || book.isbn10) {
		const isbn = book.isbn13 || book.isbn10;
		return await lookupByIsbn(isbn!);
	}

	// For books without ISBN, return what we have
	return {
		source: book.source,
		googleBooksId: book.googleBooksId,
		title: book.title,
		authors: book.authors,
		publisher: book.publisher,
		publishYear: book.publishYear,
		pageCount: book.pageCount,
		isbn10: book.isbn10,
		isbn13: book.isbn13,
		coverUrl: book.coverUrl,
		summary: book.summary,
		language: book.language,
		subjects: book.subjects || []
	};
}

/**
 * Type guard to check if result is an error
 */
export function isLookupError(result: BookLookupResult | BookSearchResult[] | LookupError): result is LookupError {
	return 'error' in result;
}
