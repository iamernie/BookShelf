/**
 * Wikipedia Service
 * Fetches author information from Wikipedia and Fandom APIs
 *
 * Falls back to Speculative Fiction Fandom wiki when Wikipedia has no results,
 * which is useful for genre authors who may not have Wikipedia articles.
 */

// API base URLs
const WIKI_API_BASE = 'https://en.wikipedia.org/w/api.php';
const FANDOM_API_BASE = 'https://speculativefiction.fandom.com/api.php';

// Available sources for author metadata
export const SOURCES = {
	wikipedia: {
		name: 'Wikipedia',
		apiBase: WIKI_API_BASE,
		icon: 'wikipedia'
	},
	fandom: {
		name: 'Speculative Fiction Fandom',
		apiBase: FANDOM_API_BASE,
		icon: 'book-open'
	}
} as const;

export type WikiSource = keyof typeof SOURCES;

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface WikiSearchResult {
	title: string;
	snippet: string;
	pageId: number;
	source: WikiSource;
	preview?: AuthorData | null;
}

export interface AuthorData {
	name: string;
	bio: string | null;
	photoUrl: string | null;
	wikipediaUrl: string;
	birthDate: string | null;
	deathDate: string | null;
	birthPlace: string | null;
	website: string | null;
	source?: WikiSource;
}

/**
 * Make an HTTPS GET request and return JSON
 */
async function fetchJson<T>(url: string): Promise<T> {
	// Check cache first
	const cached = cache.get(url);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as T;
	}

	const response = await fetch(url, {
		headers: {
			'User-Agent': 'BookShelf/2.0 (https://github.com/bookshelf; bookshelf@example.com)'
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP request failed: ${response.status}`);
	}

	const text = await response.text();

	// Check if response is HTML (Cloudflare challenge or error page)
	if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
		throw new Error('Source is protected by anti-bot measures and cannot be accessed');
	}

	const data = JSON.parse(text) as T;

	// Store in cache
	cache.set(url, { data, timestamp: Date.now() });

	return data;
}

interface WikiSearchResponse {
	query?: {
		search?: Array<{
			title: string;
			snippet: string;
			pageid: number;
		}>;
	};
}

interface WikiPageResponse {
	query?: {
		pages?: Record<
			string,
			{
				pageid?: number;
				title?: string;
				extract?: string;
				thumbnail?: { source: string };
				fullurl?: string;
				revisions?: Array<{
					slots?: {
						main?: {
							'*'?: string;
						};
					};
				}>;
			}
		>;
	};
}

/**
 * Search Wikipedia for an author
 */
export async function searchWikipedia(
	authorName: string
): Promise<{ success: boolean; results?: WikiSearchResult[]; error?: string }> {
	if (!authorName || typeof authorName !== 'string') {
		return { success: false, error: 'Invalid author name' };
	}

	try {
		// Run multiple searches in parallel for better coverage
		const exactUrl = `${WIKI_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(authorName + ' (author)')}&srlimit=3&format=json&origin=*`;
		const broadUrl = `${WIKI_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent('"' + authorName + '" writer novelist author')}&srlimit=5&format=json&origin=*`;
		const partialUrl = `${WIKI_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(authorName + ' writer')}&srlimit=3&format=json&origin=*`;

		const [exactResponse, broadResponse, partialResponse] = await Promise.all([
			fetchJson<WikiSearchResponse>(exactUrl),
			fetchJson<WikiSearchResponse>(broadUrl),
			fetchJson<WikiSearchResponse>(partialUrl)
		]);

		// Combine and deduplicate results
		const seen = new Set<number>();
		const allResults: Array<WikiSearchResult & { priority: number }> = [];

		const addResults = (response: WikiSearchResponse, priority: number) => {
			if (response.query?.search) {
				response.query.search.forEach((item) => {
					if (!seen.has(item.pageid)) {
						seen.add(item.pageid);
						allResults.push({
							title: item.title,
							snippet: item.snippet.replace(/<[^>]*>/g, ''), // Strip HTML
							pageId: item.pageid,
							source: 'wikipedia',
							priority
						});
					}
				});
			}
		};

		addResults(exactResponse, 1);
		addResults(broadResponse, 2);
		addResults(partialResponse, 3);

		// Sort by priority and take top 5
		allResults.sort((a, b) => a.priority - b.priority);
		const results = allResults.slice(0, 5).map(({ title, snippet, pageId, source }) => ({
			title,
			snippet,
			pageId,
			source
		}));

		return { success: true, results };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Get detailed author data from a Wikipedia page
 */
export async function getWikipediaAuthorData(
	pageTitle: string
): Promise<{ success: boolean; data?: AuthorData; error?: string }> {
	if (!pageTitle || typeof pageTitle !== 'string') {
		return { success: false, error: 'Invalid page title' };
	}

	try {
		// Fetch page extract, image, and URL
		const infoUrl = `${WIKI_API_BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts|pageimages|info&exintro=true&explaintext=true&pithumbsize=300&inprop=url&format=json&origin=*`;
		const response = await fetchJson<WikiPageResponse>(infoUrl);

		if (!response.query?.pages) {
			return { success: false, error: 'No data found' };
		}

		const pages = response.query.pages;
		const pageId = Object.keys(pages)[0];

		if (pageId === '-1') {
			return { success: false, error: 'Page not found' };
		}

		const page = pages[pageId];

		// Fetch wikitext to parse infobox
		const wikitextUrl = `${WIKI_API_BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*`;
		const wikitextResponse = await fetchJson<WikiPageResponse>(wikitextUrl);

		let birthDate: string | null = null;
		let deathDate: string | null = null;
		let birthPlace: string | null = null;
		let website: string | null = null;

		if (wikitextResponse.query?.pages) {
			const wtPages = wikitextResponse.query.pages;
			const wtPageId = Object.keys(wtPages)[0];
			if (wtPageId !== '-1' && wtPages[wtPageId].revisions?.[0]?.slots?.main?.['*']) {
				const wikitext = wtPages[wtPageId].revisions[0].slots!.main!['*']!;
				const parsed = parseWikipediaInfobox(wikitext);
				birthDate = parsed.birthDate;
				deathDate = parsed.deathDate;
				birthPlace = parsed.birthPlace;
				website = parsed.website;
			}
		}

		const authorData: AuthorData = {
			name: page.title || pageTitle,
			bio: page.extract ? cleanBio(page.extract) : null,
			photoUrl: page.thumbnail?.source || null,
			wikipediaUrl:
				page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
			birthDate,
			deathDate,
			birthPlace,
			website,
			source: 'wikipedia'
		};

		return { success: true, data: authorData };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Parse Wikipedia infobox for author data
 */
function parseWikipediaInfobox(wikitext: string): {
	birthDate: string | null;
	deathDate: string | null;
	birthPlace: string | null;
	website: string | null;
} {
	const result = {
		birthDate: null as string | null,
		deathDate: null as string | null,
		birthPlace: null as string | null,
		website: null as string | null
	};

	try {
		// Extract birth date - {{birth date|1965|6|31}} or {{Birth date and age|1965|6|31}}
		const birthDateMatch = wikitext.match(
			/\{\{[Bb]irth[_ ]date(?:[_ ]and[_ ]age)?\|(?:df=(?:yes|no)\|)?(?:mf=(?:yes|no)\|)?(\d{4})\|(\d{1,2})\|(\d{1,2})/
		);
		if (birthDateMatch) {
			const [, year, month, day] = birthDateMatch;
			result.birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
		} else {
			// Try simpler pattern: |birth_date = January 1, 1965
			const simpleBirthMatch = wikitext.match(
				/\|\s*birth_date\s*=\s*(?:\{\{[^}]+\}\}\s*)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i
			);
			if (simpleBirthMatch) {
				const parsed = parseTextDate(simpleBirthMatch[1]);
				if (parsed) result.birthDate = parsed;
			}
		}

		// Extract death date
		const deathDateMatch = wikitext.match(
			/\{\{[Dd]eath[_ ]date(?:[_ ]and[_ ]age)?\|(?:df=(?:yes|no)\|)?(?:mf=(?:yes|no)\|)?(\d{4})\|(\d{1,2})\|(\d{1,2})/
		);
		if (deathDateMatch) {
			const [, year, month, day] = deathDateMatch;
			result.deathDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
		} else {
			const simpleDeathMatch = wikitext.match(
				/\|\s*death_date\s*=\s*(?:\{\{[^}]+\}\}\s*)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i
			);
			if (simpleDeathMatch) {
				const parsed = parseTextDate(simpleDeathMatch[1]);
				if (parsed) result.deathDate = parsed;
			}
		}

		// Extract birth place
		const birthPlaceMatch = wikitext.match(/\|\s*birth_place\s*=\s*([^\n|{}]+)/i);
		if (birthPlaceMatch) {
			result.birthPlace = cleanWikitext(birthPlaceMatch[1]).substring(0, 255);
		}

		// Extract website
		const websiteMatch = wikitext.match(/\|\s*website\s*=\s*\{\{URL\|([^}|]+)/i);
		if (websiteMatch) {
			let url = websiteMatch[1].trim();
			if (!url.startsWith('http')) {
				url = 'https://' + url;
			}
			result.website = url;
		} else {
			const directUrlMatch = wikitext.match(/\|\s*website\s*=\s*\[?(https?:\/\/[^\s\]|]+)/i);
			if (directUrlMatch) {
				result.website = directUrlMatch[1].trim();
			}
		}
	} catch (error) {
		console.error('Error parsing infobox:', error);
	}

	return result;
}

/**
 * Parse a text date like "June 31, 1965" to ISO format
 */
function parseTextDate(dateStr: string): string | null {
	try {
		const months: Record<string, string> = {
			january: '01',
			february: '02',
			march: '03',
			april: '04',
			may: '05',
			june: '06',
			july: '07',
			august: '08',
			september: '09',
			october: '10',
			november: '11',
			december: '12'
		};

		const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
		if (match) {
			const [, monthName, day, year] = match;
			const month = months[monthName.toLowerCase()];
			if (month) {
				return `${year}-${month}-${day.padStart(2, '0')}`;
			}
		}
	} catch {
		// Ignore parsing errors
	}
	return null;
}

/**
 * Clean wikitext markup from a string
 */
function cleanWikitext(text: string): string {
	return text
		.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2') // [[link|text]] -> text
		.replace(/'''?/g, '') // Remove bold/italic
		.replace(/\{\{[^}]+\}\}/g, '') // Remove templates
		.replace(/<[^>]+>/g, '') // Remove HTML
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Clean and truncate biography text
 */
function cleanBio(bio: string): string {
	return bio.replace(/\s+/g, ' ').trim().substring(0, 5000);
}

/**
 * Search Speculative Fiction Fandom wiki for an author
 */
export async function searchFandom(
	authorName: string
): Promise<{ success: boolean; results?: WikiSearchResult[]; error?: string }> {
	if (!authorName || typeof authorName !== 'string') {
		return { success: false, error: 'Invalid author name' };
	}

	try {
		const url = `${FANDOM_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(authorName)}&srlimit=5&format=json`;
		const response = await fetchJson<WikiSearchResponse>(url);

		if (!response.query?.search) {
			return { success: false, error: 'No results found' };
		}

		const results: WikiSearchResult[] = response.query.search.map((item) => ({
			title: item.title,
			snippet: item.snippet || '',
			pageId: item.pageid,
			source: 'fandom'
		}));

		return { success: true, results };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Get author data from Fandom wiki page
 */
export async function getFandomAuthorData(
	pageTitle: string
): Promise<{ success: boolean; data?: AuthorData; error?: string }> {
	if (!pageTitle || typeof pageTitle !== 'string') {
		return { success: false, error: 'Invalid page title' };
	}

	try {
		// Get page info and image
		const infoUrl = `${FANDOM_API_BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages|info&pithumbsize=300&inprop=url&format=json`;
		const infoResponse = await fetchJson<WikiPageResponse>(infoUrl);

		if (!infoResponse.query?.pages) {
			return { success: false, error: 'No data found' };
		}

		const pages = infoResponse.query.pages;
		const pageId = Object.keys(pages)[0];

		if (pageId === '-1') {
			return { success: false, error: 'Page not found' };
		}

		const page = pages[pageId];

		// Get wikitext to parse infobox and bio
		const wikitextUrl = `${FANDOM_API_BASE}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&format=json`;
		const wikitextResponse = await fetchJson<WikiPageResponse>(wikitextUrl);

		let bio: string | null = null;
		let birthDate: string | null = null;
		let birthPlace: string | null = null;
		let website: string | null = null;

		if (wikitextResponse.query?.pages) {
			const wtPages = wikitextResponse.query.pages;
			const wtPageId = Object.keys(wtPages)[0];
			if (wtPageId !== '-1' && wtPages[wtPageId].revisions?.[0]?.slots?.main?.['*']) {
				const wikitext = wtPages[wtPageId].revisions[0].slots!.main!['*']!;
				const parsed = parseFandomInfobox(wikitext);
				birthDate = parsed.birthDate;
				birthPlace = parsed.birthPlace;
				website = parsed.website;
				bio = extractFandomBio(wikitext);
			}
		}

		const authorData: AuthorData = {
			name: page.title || pageTitle,
			bio,
			photoUrl: page.thumbnail?.source || null,
			wikipediaUrl:
				page.fullurl ||
				`https://speculativefiction.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
			birthDate,
			deathDate: null,
			birthPlace,
			website,
			source: 'fandom'
		};

		return { success: true, data: authorData };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Parse Fandom-specific infobox format
 */
function parseFandomInfobox(wikitext: string): {
	birthDate: string | null;
	birthPlace: string | null;
	website: string | null;
} {
	const result = {
		birthDate: null as string | null,
		birthPlace: null as string | null,
		website: null as string | null
	};

	try {
		// Birth year: |Bdate = 1975
		const birthYearMatch = wikitext.match(/\|Bdate\s*=\s*(\d{4})/i);
		if (birthYearMatch) {
			result.birthDate = `${birthYearMatch[1]}-01-01`;
		}

		// Birth location: |Bloc = City, State
		const birthLocMatch = wikitext.match(/\|Bloc\s*=\s*([^|\n}]+)/i);
		if (birthLocMatch) {
			result.birthPlace = cleanWikitext(birthLocMatch[1]).substring(0, 255);
		}

		// Website: |web = example.com
		const webMatch = wikitext.match(/\|web\s*=\s*([^|\n}]+)/i);
		if (webMatch) {
			let url = webMatch[1].trim();
			if (url && !url.startsWith('http')) {
				url = 'https://' + url;
			}
			result.website = url;
		}
	} catch (error) {
		console.error('Error parsing Fandom infobox:', error);
	}

	return result;
}

/**
 * Extract biography text from Fandom wikitext
 */
function extractFandomBio(wikitext: string): string | null {
	try {
		// Look for Biography section
		const bioMatch = wikitext.match(/===\s*Biography\s*===\s*\n([\s\S]*?)(?=\n==|$)/i);
		if (bioMatch) {
			return cleanWikitext(bioMatch[1]).substring(0, 5000);
		}

		// Fallback: About the Author section
		const aboutMatch = wikitext.match(/==\s*About the Author\s*==\s*\n([\s\S]*?)(?=\n==|$)/i);
		if (aboutMatch) {
			const bioSubMatch = aboutMatch[1].match(
				/===\s*Biography\s*===\s*\n([\s\S]*?)(?=\n===|$)/i
			);
			if (bioSubMatch) {
				return cleanWikitext(bioSubMatch[1]).substring(0, 5000);
			}
			const lines = aboutMatch[1]
				.split('\n')
				.filter((line) => !line.startsWith('*') && line.trim());
			if (lines.length > 0) {
				return cleanWikitext(lines.join(' ')).substring(0, 5000);
			}
		}
	} catch (error) {
		console.error('Error extracting Fandom bio:', error);
	}

	return null;
}

/**
 * Check if a result is relevant to the search
 */
function isRelevantResult(authorName: string, resultTitle: string): boolean {
	const normalizeStr = (s: string) =>
		s
			.toLowerCase()
			.replace(/[()]/g, '')
			.replace(/\./g, ' ')
			.trim();

	const searchNorm = normalizeStr(authorName);
	const titleNorm = normalizeStr(resultTitle);

	if (titleNorm.includes(searchNorm)) {
		return true;
	}

	const searchWords = searchNorm.split(/\s+/).filter((w) => w.length >= 1);
	const titleWords = titleNorm.split(/\s+/).filter((w) => w.length >= 1);

	const searchLastName = searchWords[searchWords.length - 1];
	const titleLastName = titleWords[titleWords.length - 1];

	if (searchLastName !== titleLastName) {
		return false;
	}

	const searchFirstParts = searchWords.slice(0, -1);
	const titleFirstParts = titleWords.slice(0, -1);

	const searchHasInitials = searchFirstParts.some((p) => p.length === 1);

	if (searchHasInitials && searchFirstParts.length > 0 && titleFirstParts.length > 0) {
		if (titleFirstParts.length < searchFirstParts.length) {
			return false;
		}

		for (let i = 0; i < searchFirstParts.length; i++) {
			const searchPart = searchFirstParts[i];
			const titlePart = titleFirstParts[i];

			if (searchPart.length === 1) {
				if (!titlePart.startsWith(searchPart)) {
					return false;
				}
				if (titlePart.length > 2 && searchFirstParts.length === 1) {
					return false;
				}
			} else {
				if (!titlePart.startsWith(searchPart) && !searchPart.startsWith(titlePart)) {
					return false;
				}
			}
		}
		return true;
	}

	if (searchFirstParts.length > 0 && titleFirstParts.length > 0) {
		const searchFirst = searchFirstParts[0];
		const titleFirst = titleFirstParts[0];
		return titleFirst.startsWith(searchFirst) || searchFirst.startsWith(titleFirst);
	}

	return true;
}

/**
 * Search all sources with fallback (Wikipedia first, then Fandom)
 */
export async function searchAllSources(
	authorName: string
): Promise<{ success: boolean; source?: WikiSource; results?: WikiSearchResult[]; error?: string }> {
	// Try Wikipedia first
	const wikiResult = await searchWikipedia(authorName);

	if (wikiResult.success && wikiResult.results && wikiResult.results.length > 0) {
		const relevantResults = wikiResult.results.filter((r) =>
			isRelevantResult(authorName, r.title)
		);

		if (relevantResults.length > 0) {
			return {
				success: true,
				source: 'wikipedia',
				results: relevantResults
			};
		}
	}

	// Fallback to Fandom
	const fandomResult = await searchFandom(authorName);
	if (fandomResult.success && fandomResult.results && fandomResult.results.length > 0) {
		return {
			...fandomResult,
			source: 'fandom'
		};
	}

	return { success: false, error: 'No results found in any source' };
}

/**
 * Get author data from appropriate source
 */
export async function getAuthorDataBySource(
	pageTitle: string,
	source: WikiSource
): Promise<{ success: boolean; data?: AuthorData; error?: string }> {
	if (source === 'fandom') {
		return getFandomAuthorData(pageTitle);
	}
	return getWikipediaAuthorData(pageTitle);
}

/**
 * Search and get preview data for results
 */
export async function searchWithPreview(authorName: string): Promise<{
	success: boolean;
	source?: WikiSource;
	results?: WikiSearchResult[];
	error?: string;
}> {
	const searchResult = await searchAllSources(authorName);

	if (!searchResult.success || !searchResult.results || searchResult.results.length === 0) {
		return searchResult;
	}

	// Get preview data for each result (limited to first 3)
	const resultsWithPreview: WikiSearchResult[] = [];
	for (const result of searchResult.results.slice(0, 3)) {
		const authorData = await getAuthorDataBySource(result.title, result.source);
		resultsWithPreview.push({
			...result,
			preview: authorData.success ? authorData.data : null
		});
	}

	return {
		success: true,
		source: searchResult.source,
		results: resultsWithPreview
	};
}

/**
 * Get available sources
 */
export function getAvailableSources() {
	return SOURCES;
}
