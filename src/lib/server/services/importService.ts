/**
 * Import Service
 * Handles CSV parsing, Goodreads format detection, and book data mapping
 * Ported from BookShelfV1
 */

export interface ParsedBook {
	rowIndex: number;
	originalTitle: string;
	title: string;
	author: string;
	authorId: number | null;
	authorMatch: { id: number; name: string; confidence: number; exact: boolean } | null;
	series: string | null;
	seriesId: number | null;
	seriesMatch: { id: number; title: string; exact: boolean } | null;
	bookNum: number | null;
	narrator: string;
	narratorId: number | null;
	isbn: string;
	isbn13: string;
	goodreadsId: string;
	formatId: number | null;
	format: string;
	genreId: number | null;
	genre: string;
	statusId: number | null;
	status: string;
	rating: number | null;
	startDate: string;
	completedDate: string;
	releaseDate: string;
	publishYear: number | null;
	pageCount: number | null;
	publisher: string;
	summary: string;
	comments: string;
	coverUrl: string;
	isDuplicate: boolean;
	duplicateBookId: number | null;
}

export interface CSVParseResult {
	headers: string[];
	rows: Record<string, string>[];
}

/**
 * Parse series information from Goodreads-style titles
 * Handles formats like:
 *   "The Way of Kings (The Stormlight Archive, #1)"
 *   "Gardens of the Moon (Malazan, Book One)"
 *   "One Piece (One Piece, Vol. 1)"
 */
export function parseSeriesFromTitle(title: string): { cleanTitle: string; series: string | null; bookNum: number | null } {
	if (!title) return { cleanTitle: title, series: null, bookNum: null };

	// Pattern 1: "Title (Series, #1)" or "Title (Series, #1.5)"
	let match = title.match(/^(.+?)\s*\(([^)]+?),?\s*#(\d+(?:\.\d+)?)\)$/);
	if (match) {
		return {
			cleanTitle: match[1].trim(),
			series: match[2].trim(),
			bookNum: parseFloat(match[3])
		};
	}

	// Pattern 2: "Title (Series, Book One/Two/Three/etc)"
	match = title.match(/^(.+?)\s*\(([^)]+?),?\s*Book\s+(\w+)\)$/i);
	if (match) {
		const numWord = match[3].toLowerCase();
		const wordToNum: Record<string, number> = {
			'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
			'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
			'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15
		};
		const bookNum = wordToNum[numWord] || parseInt(numWord) || null;
		return {
			cleanTitle: match[1].trim(),
			series: match[2].trim(),
			bookNum: bookNum
		};
	}

	// Pattern 3: "Title (Series, Vol. 1)" or "Title (Series, Part 1)"
	match = title.match(/^(.+?)\s*\(([^)]+?),?\s*(?:Vol\.?|Part|Volume)\s*(\d+)\)$/i);
	if (match) {
		return {
			cleanTitle: match[1].trim(),
			series: match[2].trim(),
			bookNum: parseInt(match[3])
		};
	}

	// Pattern 4: "Title (Series #1)" - no comma
	match = title.match(/^(.+?)\s*\(([^)]+?)\s*#(\d+(?:\.\d+)?)\)$/);
	if (match) {
		return {
			cleanTitle: match[1].trim(),
			series: match[2].trim(),
			bookNum: parseFloat(match[3])
		};
	}

	// No series found
	return { cleanTitle: title, series: null, bookNum: null };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let j = 0; j < line.length; j++) {
		const char = line[j];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
			current = '';
		} else {
			current += char;
		}
	}
	values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
	return values;
}

/**
 * Parse CSV content into array of objects
 */
export function parseCSV(csvContent: string): CSVParseResult {
	const lines = csvContent.split('\n');
	if (lines.length < 2) {
		return { headers: [], rows: [] };
	}

	// Parse headers
	const headers = parseCSVLine(lines[0]);

	// Parse data rows
	const rows: Record<string, string>[] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const values = parseCSVLine(line);
		const rowData: Record<string, string> = {};
		headers.forEach((header, index) => {
			rowData[header] = values[index] || '';
		});
		rows.push(rowData);
	}

	return { headers, rows };
}

/**
 * Detect if CSV is Goodreads format
 */
export function isGoodreadsFormat(headers: string[]): boolean {
	return headers.includes('Title') && headers.includes('Author') &&
		(headers.includes('Bookshelves') || headers.includes('Exclusive Shelf'));
}

/**
 * Convert date string to YYYY-MM-DD format for HTML date input
 * Handles Goodreads format (YYYY/MM/DD) and other common formats
 */
function formatDateForInput(dateStr: string): string {
	if (!dateStr || !dateStr.trim()) return '';

	const str = dateStr.trim();

	// Already in YYYY-MM-DD format
	if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
		return str;
	}

	// Goodreads format: YYYY/MM/DD
	if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
		return str.replace(/\//g, '-');
	}

	// Try parsing as date
	const date = new Date(str);
	if (!isNaN(date.getTime())) {
		return date.toISOString().split('T')[0];
	}

	return '';
}

interface MappedRow {
	title: string;
	author: string;
	additionalAuthors?: string;
	series?: string;
	bookNum?: string;
	isbn: string;
	isbn13: string;
	narrator?: string;
	format: string;
	genre?: string;
	status: string;
	rating: string;
	startDate: string;
	completedDate: string;
	releaseDate?: string;
	publishYear: string;
	pageCount: string;
	publisher: string;
	summary?: string;
	comments: string;
	goodreadsId: string;
}

/**
 * Map Goodreads row to standardized format
 */
export function mapGoodreadsRow(row: Record<string, string>): MappedRow {
	// Map Goodreads shelf to our status key (matched by key in CSV import)
	let status = '';
	const shelf = row['Exclusive Shelf'] || '';
	if (shelf === 'read') status = 'read'; // Maps to status with key 'READ' (Done)
	else if (shelf === 'currently-reading') status = 'current'; // Maps to key 'CURRENT'
	else if (shelf === 'to-read') status = 'next'; // Maps to key 'NEXT'

	// Clean ISBN values - Goodreads wraps them in ="" format
	const cleanIsbn = (val: string) => val ? val.replace(/[="]/g, '').trim() : '';

	// Use Original Publication Year if available, fall back to Year Published
	const pubYear = row['Original Publication Year'] || row['Year Published'] || '';

	return {
		title: row.Title || '',
		author: row.Author || row['Author l-f'] || '',
		additionalAuthors: row['Additional Authors'] || '',
		isbn: cleanIsbn(row.ISBN),
		isbn13: cleanIsbn(row.ISBN13),
		format: row.Binding || '',
		status: status,
		rating: row['My Rating'] || '',
		startDate: formatDateForInput(row['Date Started']),
		completedDate: formatDateForInput(row['Date Read']),
		publishYear: pubYear,
		pageCount: row['Number of Pages'] || '',
		publisher: row.Publisher || '',
		comments: row['My Review'] || '',
		goodreadsId: row['Book Id'] || ''
	};
}

/**
 * Map standard CSV row
 */
export function mapStandardRow(row: Record<string, string>): MappedRow {
	return {
		title: row.Title || row.title || '',
		author: row.Author || row.author || '',
		series: row.Series || row.series || '',
		bookNum: row['Book Number'] || row.bookNum || row['Book #'] || '',
		isbn: row.ISBN || row.isbn || row.ISBN10 || row.isbn10 || '',
		isbn13: row.ISBN13 || row.isbn13 || '',
		narrator: row.Narrator || row.narrator || '',
		format: row.Format || row.format || '',
		genre: row.Genre || row.genre || '',
		status: row.Status || row.status || '',
		rating: row.Rating || row.rating || '',
		startDate: row['Start Date'] || row.startDate || '',
		completedDate: row['Completed Date'] || row.completedDate || row['End Date'] || '',
		releaseDate: row['Release Date'] || row.releaseDate || '',
		publishYear: row['Publish Year'] || row.publishYear || row['Year Published'] || '',
		pageCount: row['Page Count'] || row.pageCount || row['Number of Pages'] || '',
		publisher: row.Publisher || row.publisher || '',
		summary: row.Summary || row.summary || row.Description || row.description || '',
		comments: row.Comments || row.comments || row.Notes || row.notes || '',
		goodreadsId: row['Goodreads ID'] || row.goodreadsId || ''
	};
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
	const m = str1.length;
	const n = str2.length;

	const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (str1[i - 1] === str2[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1];
			} else {
				dp[i][j] = 1 + Math.min(
					dp[i - 1][j],
					dp[i][j - 1],
					dp[i - 1][j - 1]
				);
			}
		}
	}

	return dp[m][n];
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
	if (str1 === str2) return 1;
	if (!str1 || !str2) return 0;

	const tokens1 = str1.split(' ').filter(t => t.length > 0);
	const tokens2 = str2.split(' ').filter(t => t.length > 0);

	let matchingTokens = 0;
	for (const t1 of tokens1) {
		for (const t2 of tokens2) {
			if (t1 === t2 || levenshteinDistance(t1, t2) <= 1) {
				matchingTokens++;
				break;
			}
		}
	}

	const tokenScore = matchingTokens / Math.max(tokens1.length, tokens2.length);
	const maxLen = Math.max(str1.length, str2.length);
	const editDistance = levenshteinDistance(str1, str2);
	const editScore = 1 - (editDistance / maxLen);

	return (tokenScore * 0.6) + (editScore * 0.4);
}

/**
 * Normalize author name for comparison
 */
export function normalizeAuthorName(name: string): string {
	if (!name) return '';

	let normalized = name.toLowerCase().trim();

	// Handle "Last, First" format
	if (normalized.includes(',')) {
		const parts = normalized.split(',').map(p => p.trim());
		if (parts.length === 2) {
			normalized = `${parts[1]} ${parts[0]}`;
		}
	}

	// Remove punctuation and extra spaces
	normalized = normalized
		.replace(/[.']/g, '')
		.replace(/[-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return normalized;
}

/**
 * Normalize string for comparison
 */
export function normalizeString(str: string): string {
	if (!str) return '';
	return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Simple fuzzy match between two strings, returns similarity score 0-1
 */
export function fuzzyMatch(str1: string, str2: string): number {
	if (!str1 || !str2) return 0;
	return calculateSimilarity(normalizeString(str1), normalizeString(str2));
}

/**
 * Fuzzy match author name against a list of existing authors
 */
export function fuzzyMatchAuthor(
	searchName: string,
	existingAuthors: { id: number; name: string }[]
): { author: { id: number; name: string }; confidence: number; exact: boolean } | null {
	if (!searchName || !existingAuthors || existingAuthors.length === 0) {
		return null;
	}

	const normalizedSearch = normalizeAuthorName(searchName);
	let bestMatch: { id: number; name: string } | null = null;
	let bestScore = 0;

	for (const author of existingAuthors) {
		const normalizedExisting = normalizeAuthorName(author.name);
		const score = calculateSimilarity(normalizedSearch, normalizedExisting);

		if (score > bestScore) {
			bestScore = score;
			bestMatch = author;
		}
	}

	if (bestScore >= 0.8 && bestMatch) {
		return {
			author: bestMatch,
			confidence: Math.round(bestScore * 100),
			exact: bestScore === 1
		};
	}

	return null;
}

/**
 * Check if a book is a duplicate based on ISBN, Goodreads ID, or fuzzy title/author match
 */
export function findDuplicate(
	book: { title: string; author: string; isbn?: string; isbn13?: string; goodreadsId?: string },
	existingBooks: { id: number; title: string; author: string; isbn10: string | null; isbn13: string | null; goodreadsId: string | null }[]
): { id: number; title: string } | null {
	// Check by ISBN13 first
	if (book.isbn13) {
		const match = existingBooks.find(eb => eb.isbn13 === book.isbn13);
		if (match) return { id: match.id, title: match.title };
	}

	// Check by ISBN10
	if (book.isbn) {
		const match = existingBooks.find(eb => eb.isbn10 === book.isbn || eb.isbn13 === book.isbn);
		if (match) return { id: match.id, title: match.title };
	}

	// Check by Goodreads ID
	if (book.goodreadsId) {
		const match = existingBooks.find(eb => eb.goodreadsId === book.goodreadsId);
		if (match) return { id: match.id, title: match.title };
	}

	// Fuzzy title/author match
	const normalizedTitle = normalizeString(book.title);
	const normalizedAuthor = normalizeAuthorName(book.author);

	for (const existing of existingBooks) {
		const existingTitle = normalizeString(existing.title);
		const existingAuthor = normalizeAuthorName(existing.author);

		const titleSimilarity = calculateSimilarity(normalizedTitle, existingTitle);
		const authorSimilarity = calculateSimilarity(normalizedAuthor, existingAuthor);

		if (titleSimilarity >= 0.85 && authorSimilarity >= 0.8) {
			return { id: existing.id, title: existing.title };
		}
	}

	return null;
}
