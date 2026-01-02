/**
 * Audible Import Service
 * Parses Audible listening history HTML exports
 */

export interface AudibleBook {
	title: string;
	author: string;
	imageUrl: string;
	listenDate: string | null;
	asin: string;
}

/**
 * Parse Audible listening history HTML to extract book data
 */
export function parseAudibleHtml(htmlContent: string): AudibleBook[] {
	const books: AudibleBook[] = [];

	// More flexible pattern to capture book entries
	const bookBlockRegex = /<li[^>]*class="[^"]*bc-list-item[^"]*"[^>]*>([\s\S]*?)(?=<li[^>]*class="[^"]*bc-list-item|<\/ul>)/gi;

	let matches;

	// Try to find book entries using the bc-list-item pattern
	while ((matches = bookBlockRegex.exec(htmlContent)) !== null) {
		const block = matches[1];

		// Only process blocks that contain listening history items
		if (!block.includes('ui-it-listenhistory-item-title') && !block.includes('listenHistoryRow')) {
			continue;
		}

		try {
			const book = extractBookData(block);
			if (book && book.title) {
				books.push(book);
			}
		} catch (err) {
			console.error('Error parsing book block:', err);
		}
	}

	// If the list-item approach didn't work, try a different pattern
	if (books.length === 0) {
		const fallbackBooks = parseAudibleFallback(htmlContent);
		books.push(...fallbackBooks);
	}

	return books;
}

/**
 * Fallback parsing method if primary method fails
 */
function parseAudibleFallback(htmlContent: string): AudibleBook[] {
	const books: AudibleBook[] = [];

	// Try matching based on the title class directly
	const titleRegex = /<div[^>]*class="[^"]*ui-it-listenhistory-item-title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
	const dateRegex = /<div[^>]*class="[^"]*ui-it-listenhistory-item-listendate[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

	const titles: string[] = [];
	const dates: string[] = [];

	let titleMatch;
	while ((titleMatch = titleRegex.exec(htmlContent)) !== null) {
		titles.push(titleMatch[1]);
	}

	let dateMatch;
	while ((dateMatch = dateRegex.exec(htmlContent)) !== null) {
		dates.push(dateMatch[1]);
	}

	// Extract images and convert local paths to Amazon URLs
	const imageRegex = /<img[^>]*class="[^"]*bc-image-inset-border[^"]*"[^>]*src="([^"]*)"[^>]*>/gi;
	const images: string[] = [];
	let imgMatch;
	while ((imgMatch = imageRegex.exec(htmlContent)) !== null) {
		let imageUrl = imgMatch[1];
		// Convert local saved file paths to Amazon URLs
		const filenameMatch = imageUrl.match(/([0-9A-Za-z]{2}[0-9A-Za-z+_-]*\._SL\d+_\.(?:jpg|jpeg|png))$/i);
		if (filenameMatch) {
			imageUrl = `https://m.media-amazon.com/images/I/${filenameMatch[1]}`;
		}
		images.push(imageUrl);
	}

	// Extract authors (By: pattern)
	const authorRegex = /By:\s*([^<]+)/gi;
	const authors: string[] = [];
	let authMatch;
	while ((authMatch = authorRegex.exec(htmlContent)) !== null) {
		authors.push(authMatch[1].trim());
	}

	// Extract ASINs from product links
	const asinRegex = /\/pd\/([A-Z0-9]{10})/gi;
	const asins: string[] = [];
	let asinMatch;
	while ((asinMatch = asinRegex.exec(htmlContent)) !== null) {
		if (!asins.includes(asinMatch[1])) {
			asins.push(asinMatch[1]);
		}
	}

	// Combine extracted data
	for (let i = 0; i < titles.length; i++) {
		const titleHtml = titles[i];
		const titleTextMatch = titleHtml.match(/<span[^>]*class="[^"]*bc-text[^"]*bc-color-base[^"]*"[^>]*>([^<]+)<\/span>/i);
		const title = titleTextMatch ? titleTextMatch[1].trim() : '';

		if (title) {
			books.push({
				title,
				author: authors[i] || '',
				imageUrl: images[i] || '',
				listenDate: extractDate(dates[i] || ''),
				asin: asins[i] || ''
			});
		}
	}

	return books;
}

/**
 * Extract book data from an HTML block
 */
function extractBookData(block: string): AudibleBook {
	const book: AudibleBook = {
		title: '',
		author: '',
		imageUrl: '',
		listenDate: null,
		asin: ''
	};

	// Extract title
	const titleMatch = block.match(/<span[^>]*class="[^"]*bc-text[^"]*bc-color-base[^"]*"[^>]*>([^<]+)<\/span>/i);
	if (titleMatch) {
		book.title = titleMatch[1].trim();
	}

	// Extract author (By: pattern)
	const authorMatch = block.match(/By:\s*([^<]+)/i);
	if (authorMatch) {
		book.author = authorMatch[1].trim();
	}

	// Extract image URL - try multiple patterns
	book.imageUrl = extractImageUrl(block);

	// Extract listen date
	const dateMatch = block.match(/ui-it-listenhistory-item-listendate[^>]*>([^<]+)</i);
	if (dateMatch) {
		book.listenDate = extractDate(dateMatch[1]);
	}

	// Extract ASIN from product link
	const asinMatch = block.match(/\/pd\/([A-Z0-9]{10})/i);
	if (asinMatch) {
		book.asin = asinMatch[1];
	}

	return book;
}

/**
 * Extract image URL from HTML block, handling various formats
 */
function extractImageUrl(block: string): string {
	// First try: images with amazon/audible/m.media-amazon in URL (full URLs)
	let imgMatch = block.match(/<img[^>]*src="(https?:\/\/[^"]*(?:amazon|audible|m\.media)[^"]*)"/i);
	if (imgMatch) {
		return imgMatch[1];
	}

	// Second try: data-src attribute (lazy loaded images with full URL)
	imgMatch = block.match(/data-src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png)[^"]*)"/i);
	if (imgMatch) {
		return imgMatch[1];
	}

	// Third try: Local saved file - extract Amazon image filename from relative path
	const allImgMatches = block.match(/<img[^>]*src="([^"]*)"/gi);
	if (allImgMatches) {
		for (const imgTag of allImgMatches) {
			const srcMatch = imgTag.match(/src="([^"]*)"/i);
			if (srcMatch) {
				const srcValue = srcMatch[1];
				// Look for Amazon image filename pattern
				const filenameMatch = srcValue.match(/([0-9A-Za-z]{2}[0-9A-Za-z+_-]*\._SL\d+_\.(?:jpg|jpeg|png))$/i);
				if (filenameMatch) {
					return `https://m.media-amazon.com/images/I/${filenameMatch[1]}`;
				}
				// Try Amazon image with different suffix format
				const altFilenameMatch = srcValue.match(/([0-9A-Za-z]{2}[0-9A-Za-z+_-]*\._[A-Z]{2}[A-Z0-9_]*_\.(?:jpg|jpeg|png))$/i);
				if (altFilenameMatch) {
					return `https://m.media-amazon.com/images/I/${altFilenameMatch[1]}`;
				}
			}
		}
	}

	// Fourth try: any full https URL in an img tag
	imgMatch = block.match(/<img[^>]*src="(https?:\/\/[^"]+)"/i);
	if (imgMatch) {
		return imgMatch[1];
	}

	return '';
}

/**
 * Parse a date string in various formats
 */
function extractDate(dateStr: string): string | null {
	if (!dateStr) return null;

	const cleaned = dateStr.trim();

	// Try DD-MM-YYYY format
	const match = cleaned.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
	if (match) {
		const day = parseInt(match[1], 10);
		const month = parseInt(match[2], 10);
		const year = parseInt(match[3], 10);
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	// Try YYYY-MM-DD format
	const match2 = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (match2) {
		const year = parseInt(match2[1], 10);
		const month = parseInt(match2[2], 10);
		const day = parseInt(match2[3], 10);
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	return null;
}

/**
 * Calculate start reading date (5 days before listen date)
 */
export function calculateStartDate(listenDate: string | null): string | null {
	if (!listenDate) return null;
	const date = new Date(listenDate);
	if (isNaN(date.getTime())) return null;
	date.setDate(date.getDate() - 5);
	return date.toISOString().split('T')[0];
}

/**
 * Check if a date is in the past
 */
export function isDateInPast(dateStr: string | null): boolean {
	if (!dateStr) return false;
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return false;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
}
