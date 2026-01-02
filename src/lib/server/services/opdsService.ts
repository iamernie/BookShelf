import { db, books, authors, series, genres, bookAuthors, bookSeries } from '$lib/server/db';
import { eq, desc, asc, like, sql, and, or } from 'drizzle-orm';

// OPDS 1.2 Catalog Service
// Spec: https://specs.opds.io/opds-1.2

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=navigation';
const OPDS_ACQUISITION_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';
const ATOM_MIME = 'application/atom+xml';

interface OPDSConfig {
	baseUrl: string;
	title: string;
	author: string;
	icon?: string;
}

interface BookEntry {
	id: number;
	title: string;
	summary: string | null;
	coverImageUrl: string | null;
	ebookPath: string | null;
	ebookFormat: string | null;
	updatedAt: string | null;
	createdAt: string | null;
	authorName?: string | null;
	seriesName?: string | null;
	bookNum?: number | null;
	genreName?: string | null;
}

interface NavigationEntry {
	title: string;
	href: string;
	id: string;
	content?: string;
	count?: number;
}

// Escape XML special characters
function escapeXml(str: string | null | undefined): string {
	if (!str) return '';
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// Format date for Atom
function formatDate(date: string | null | undefined): string {
	if (!date) return new Date().toISOString();
	try {
		return new Date(date).toISOString();
	} catch {
		return new Date().toISOString();
	}
}

// Get MIME type for ebook format
function getEbookMime(format: string | null): string {
	switch (format?.toLowerCase()) {
		case 'epub': return 'application/epub+zip';
		case 'pdf': return 'application/pdf';
		case 'mobi': return 'application/x-mobipocket-ebook';
		case 'azw': return 'application/vnd.amazon.ebook';
		case 'azw3': return 'application/vnd.amazon.ebook';
		case 'cbz': return 'application/vnd.comicbook+zip';
		case 'cbr': return 'application/vnd.comicbook-rar';
		default: return 'application/octet-stream';
	}
}

// Generate XML header
function xmlHeader(): string {
	return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

// Generate feed opening
function feedOpen(config: OPDSConfig, feedId: string, title: string, updated: string): string {
	return `<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog"
      xmlns:dc="http://purl.org/dc/elements/1.1/">
  <id>${escapeXml(feedId)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${updated}</updated>
  <author>
    <name>${escapeXml(config.author)}</name>
  </author>
  ${config.icon ? `<icon>${escapeXml(config.icon)}</icon>` : ''}
`;
}

// Generate standard links
function standardLinks(config: OPDSConfig, selfHref: string): string {
	return `  <link rel="self" href="${escapeXml(config.baseUrl + selfHref)}" type="${OPDS_MIME}"/>
  <link rel="start" href="${escapeXml(config.baseUrl)}/opds" type="${OPDS_MIME}"/>
  <link rel="search" href="${escapeXml(config.baseUrl)}/opds/search?q={searchTerms}" type="${ATOM_MIME}"/>
`;
}

// Generate pagination links
function paginationLinks(config: OPDSConfig, baseHref: string, page: number, totalPages: number): string {
	let links = '';
	if (page > 1) {
		links += `  <link rel="previous" href="${escapeXml(config.baseUrl + baseHref)}?page=${page - 1}" type="${OPDS_ACQUISITION_MIME}"/>\n`;
	}
	if (page < totalPages) {
		links += `  <link rel="next" href="${escapeXml(config.baseUrl + baseHref)}?page=${page + 1}" type="${OPDS_ACQUISITION_MIME}"/>\n`;
	}
	return links;
}

// Generate navigation entry
function navigationEntry(config: OPDSConfig, entry: NavigationEntry): string {
	return `  <entry>
    <title>${escapeXml(entry.title)}</title>
    <link rel="subsection" href="${escapeXml(config.baseUrl + entry.href)}" type="${OPDS_ACQUISITION_MIME}"/>
    <id>${escapeXml(entry.id)}</id>
    ${entry.content ? `<content type="text">${escapeXml(entry.content)}</content>` : ''}
    <updated>${new Date().toISOString()}</updated>
  </entry>
`;
}

// Generate book entry
function bookEntry(config: OPDSConfig, book: BookEntry): string {
	const updated = formatDate(book.updatedAt || book.createdAt);

	let entry = `  <entry>
    <title>${escapeXml(book.title)}</title>
    <id>urn:bookshelf:book:${book.id}</id>
    <updated>${updated}</updated>
`;

	if (book.authorName) {
		entry += `    <author><name>${escapeXml(book.authorName)}</name></author>\n`;
	}

	if (book.summary) {
		entry += `    <summary type="text">${escapeXml(book.summary)}</summary>\n`;
	}

	if (book.genreName) {
		entry += `    <category term="${escapeXml(book.genreName)}"/>\n`;
	}

	if (book.seriesName) {
		entry += `    <dc:publisher>${escapeXml(book.seriesName)}${book.bookNum ? ` #${book.bookNum}` : ''}</dc:publisher>\n`;
	}

	// Cover image
	if (book.coverImageUrl) {
		const coverUrl = book.coverImageUrl.startsWith('http')
			? book.coverImageUrl
			: config.baseUrl + book.coverImageUrl;
		entry += `    <link rel="http://opds-spec.org/image" href="${escapeXml(coverUrl)}" type="image/jpeg"/>\n`;
		entry += `    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(coverUrl)}" type="image/jpeg"/>\n`;
	}

	// Acquisition link (download)
	if (book.ebookPath) {
		const mime = getEbookMime(book.ebookFormat);
		entry += `    <link rel="http://opds-spec.org/acquisition" href="${escapeXml(config.baseUrl)}/api/ebooks/${book.id}/download" type="${mime}"/>\n`;
	}

	entry += `  </entry>\n`;
	return entry;
}

// Close feed
function feedClose(): string {
	return '</feed>';
}

// ============================================
// Feed Generators
// ============================================

export function generateRootCatalog(config: OPDSConfig): string {
	const entries: NavigationEntry[] = [
		{ title: 'All Books', href: '/opds/books', id: 'urn:bookshelf:books', content: 'Browse all books in the library' },
		{ title: 'Recent Additions', href: '/opds/books/recent', id: 'urn:bookshelf:recent', content: 'Recently added books' },
		{ title: 'Authors', href: '/opds/authors', id: 'urn:bookshelf:authors', content: 'Browse books by author' },
		{ title: 'Series', href: '/opds/series', id: 'urn:bookshelf:series', content: 'Browse books by series' },
		{ title: 'Genres', href: '/opds/genres', id: 'urn:bookshelf:genres', content: 'Browse books by genre' }
	];

	let xml = xmlHeader();
	xml += feedOpen(config, 'urn:bookshelf:root', config.title, new Date().toISOString());
	xml += standardLinks(config, '/opds');

	for (const entry of entries) {
		xml += navigationEntry(config, entry);
	}

	xml += feedClose();
	return xml;
}

export async function generateBooksFeed(
	config: OPDSConfig,
	options: { page?: number; limit?: number; orderBy?: 'title' | 'recent' } = {}
): Promise<string> {
	const page = options.page || 1;
	const limit = options.limit || 50;
	const offset = (page - 1) * limit;
	const orderBy = options.orderBy || 'title';

	// Get total count
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)` })
		.from(books)
		.where(sql`${books.ebookPath} IS NOT NULL`);

	const totalPages = Math.ceil(total / limit);

	// Get books with authors
	const bookResults = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			updatedAt: books.updatedAt,
			createdAt: books.createdAt,
			bookNum: books.bookNum,
			authorName: authors.name,
			genreName: genres.name,
			seriesTitle: series.title
		})
		.from(books)
		.leftJoin(bookAuthors, and(eq(bookAuthors.bookId, books.id), eq(bookAuthors.isPrimary, true)))
		.leftJoin(authors, eq(authors.id, bookAuthors.authorId))
		.leftJoin(genres, eq(genres.id, books.genreId))
		.leftJoin(bookSeries, and(eq(bookSeries.bookId, books.id), eq(bookSeries.isPrimary, true)))
		.leftJoin(series, eq(series.id, bookSeries.seriesId))
		.where(sql`${books.ebookPath} IS NOT NULL`)
		.orderBy(orderBy === 'recent' ? desc(books.createdAt) : asc(books.title))
		.limit(limit)
		.offset(offset);

	const feedTitle = orderBy === 'recent' ? 'Recent Additions' : 'All Books';
	const selfHref = orderBy === 'recent' ? '/opds/books/recent' : '/opds/books';

	let xml = xmlHeader();
	xml += feedOpen(config, `urn:bookshelf:books:${orderBy}`, feedTitle, new Date().toISOString());
	xml += standardLinks(config, selfHref);
	xml += paginationLinks(config, selfHref, page, totalPages);

	for (const book of bookResults) {
		xml += bookEntry(config, {
			...book,
			seriesName: book.seriesTitle
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateAuthorsFeed(config: OPDSConfig): Promise<string> {
	const authorResults = await db
		.select({
			id: authors.id,
			name: authors.name,
			bookCount: sql<number>`count(${bookAuthors.bookId})`
		})
		.from(authors)
		.leftJoin(bookAuthors, eq(bookAuthors.authorId, authors.id))
		.groupBy(authors.id)
		.having(sql`count(${bookAuthors.bookId}) > 0`)
		.orderBy(asc(authors.name));

	let xml = xmlHeader();
	xml += feedOpen(config, 'urn:bookshelf:authors', 'Authors', new Date().toISOString());
	xml += standardLinks(config, '/opds/authors');

	for (const author of authorResults) {
		xml += navigationEntry(config, {
			title: author.name,
			href: `/opds/authors/${author.id}`,
			id: `urn:bookshelf:author:${author.id}`,
			content: `${author.bookCount} book${author.bookCount !== 1 ? 's' : ''}`
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateAuthorBooksFeed(config: OPDSConfig, authorId: number): Promise<string> {
	// Get author info
	const [author] = await db.select().from(authors).where(eq(authors.id, authorId)).limit(1);
	if (!author) {
		return generateErrorFeed(config, 'Author not found');
	}

	// Get books by author
	const bookResults = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			updatedAt: books.updatedAt,
			createdAt: books.createdAt,
			bookNum: books.bookNum,
			genreName: genres.name,
			seriesTitle: series.title
		})
		.from(books)
		.innerJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
		.leftJoin(genres, eq(genres.id, books.genreId))
		.leftJoin(bookSeries, and(eq(bookSeries.bookId, books.id), eq(bookSeries.isPrimary, true)))
		.leftJoin(series, eq(series.id, bookSeries.seriesId))
		.where(and(
			eq(bookAuthors.authorId, authorId),
			sql`${books.ebookPath} IS NOT NULL`
		))
		.orderBy(asc(books.title));

	let xml = xmlHeader();
	xml += feedOpen(config, `urn:bookshelf:author:${authorId}`, `Books by ${author.name}`, new Date().toISOString());
	xml += standardLinks(config, `/opds/authors/${authorId}`);

	for (const book of bookResults) {
		xml += bookEntry(config, {
			...book,
			authorName: author.name,
			seriesName: book.seriesTitle
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateSeriesFeed(config: OPDSConfig): Promise<string> {
	const seriesResults = await db
		.select({
			id: series.id,
			title: series.title,
			bookCount: sql<number>`count(${bookSeries.bookId})`
		})
		.from(series)
		.leftJoin(bookSeries, eq(bookSeries.seriesId, series.id))
		.groupBy(series.id)
		.having(sql`count(${bookSeries.bookId}) > 0`)
		.orderBy(asc(series.title));

	let xml = xmlHeader();
	xml += feedOpen(config, 'urn:bookshelf:series', 'Series', new Date().toISOString());
	xml += standardLinks(config, '/opds/series');

	for (const s of seriesResults) {
		xml += navigationEntry(config, {
			title: s.title,
			href: `/opds/series/${s.id}`,
			id: `urn:bookshelf:series:${s.id}`,
			content: `${s.bookCount} book${s.bookCount !== 1 ? 's' : ''}`
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateSeriesBooksFeed(config: OPDSConfig, seriesId: number): Promise<string> {
	// Get series info
	const [s] = await db.select().from(series).where(eq(series.id, seriesId)).limit(1);
	if (!s) {
		return generateErrorFeed(config, 'Series not found');
	}

	// Get books in series
	const bookResults = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			updatedAt: books.updatedAt,
			createdAt: books.createdAt,
			bookNum: bookSeries.bookNum,
			authorName: authors.name,
			genreName: genres.name
		})
		.from(books)
		.innerJoin(bookSeries, eq(bookSeries.bookId, books.id))
		.leftJoin(bookAuthors, and(eq(bookAuthors.bookId, books.id), eq(bookAuthors.isPrimary, true)))
		.leftJoin(authors, eq(authors.id, bookAuthors.authorId))
		.leftJoin(genres, eq(genres.id, books.genreId))
		.where(and(
			eq(bookSeries.seriesId, seriesId),
			sql`${books.ebookPath} IS NOT NULL`
		))
		.orderBy(asc(bookSeries.bookNum));

	let xml = xmlHeader();
	xml += feedOpen(config, `urn:bookshelf:series:${seriesId}`, s.title, new Date().toISOString());
	xml += standardLinks(config, `/opds/series/${seriesId}`);

	for (const book of bookResults) {
		xml += bookEntry(config, {
			...book,
			seriesName: s.title
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateGenresFeed(config: OPDSConfig): Promise<string> {
	const genreResults = await db
		.select({
			id: genres.id,
			name: genres.name,
			bookCount: sql<number>`count(${books.id})`
		})
		.from(genres)
		.leftJoin(books, eq(books.genreId, genres.id))
		.groupBy(genres.id)
		.having(sql`count(${books.id}) > 0`)
		.orderBy(asc(genres.name));

	let xml = xmlHeader();
	xml += feedOpen(config, 'urn:bookshelf:genres', 'Genres', new Date().toISOString());
	xml += standardLinks(config, '/opds/genres');

	for (const genre of genreResults) {
		xml += navigationEntry(config, {
			title: genre.name,
			href: `/opds/genres/${genre.id}`,
			id: `urn:bookshelf:genre:${genre.id}`,
			content: `${genre.bookCount} book${genre.bookCount !== 1 ? 's' : ''}`
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateGenreBooksFeed(config: OPDSConfig, genreId: number): Promise<string> {
	// Get genre info
	const [genre] = await db.select().from(genres).where(eq(genres.id, genreId)).limit(1);
	if (!genre) {
		return generateErrorFeed(config, 'Genre not found');
	}

	// Get books in genre
	const bookResults = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			updatedAt: books.updatedAt,
			createdAt: books.createdAt,
			bookNum: books.bookNum,
			authorName: authors.name,
			seriesTitle: series.title
		})
		.from(books)
		.leftJoin(bookAuthors, and(eq(bookAuthors.bookId, books.id), eq(bookAuthors.isPrimary, true)))
		.leftJoin(authors, eq(authors.id, bookAuthors.authorId))
		.leftJoin(bookSeries, and(eq(bookSeries.bookId, books.id), eq(bookSeries.isPrimary, true)))
		.leftJoin(series, eq(series.id, bookSeries.seriesId))
		.where(and(
			eq(books.genreId, genreId),
			sql`${books.ebookPath} IS NOT NULL`
		))
		.orderBy(asc(books.title));

	let xml = xmlHeader();
	xml += feedOpen(config, `urn:bookshelf:genre:${genreId}`, genre.name, new Date().toISOString());
	xml += standardLinks(config, `/opds/genres/${genreId}`);

	for (const book of bookResults) {
		xml += bookEntry(config, {
			...book,
			genreName: genre.name,
			seriesName: book.seriesTitle
		});
	}

	xml += feedClose();
	return xml;
}

export async function generateSearchFeed(config: OPDSConfig, query: string): Promise<string> {
	if (!query || query.trim().length < 2) {
		return generateErrorFeed(config, 'Search query too short');
	}

	const searchTerm = `%${query.trim()}%`;

	// Search books by title and author
	const bookResults = await db
		.select({
			id: books.id,
			title: books.title,
			summary: books.summary,
			coverImageUrl: books.coverImageUrl,
			ebookPath: books.ebookPath,
			ebookFormat: books.ebookFormat,
			updatedAt: books.updatedAt,
			createdAt: books.createdAt,
			bookNum: books.bookNum,
			authorName: authors.name,
			genreName: genres.name,
			seriesTitle: series.title
		})
		.from(books)
		.leftJoin(bookAuthors, and(eq(bookAuthors.bookId, books.id), eq(bookAuthors.isPrimary, true)))
		.leftJoin(authors, eq(authors.id, bookAuthors.authorId))
		.leftJoin(genres, eq(genres.id, books.genreId))
		.leftJoin(bookSeries, and(eq(bookSeries.bookId, books.id), eq(bookSeries.isPrimary, true)))
		.leftJoin(series, eq(series.id, bookSeries.seriesId))
		.where(and(
			sql`${books.ebookPath} IS NOT NULL`,
			or(
				like(books.title, searchTerm),
				like(authors.name, searchTerm),
				like(series.title, searchTerm)
			)
		))
		.orderBy(asc(books.title))
		.limit(100);

	let xml = xmlHeader();
	xml += feedOpen(config, `urn:bookshelf:search:${encodeURIComponent(query)}`, `Search: ${query}`, new Date().toISOString());
	xml += standardLinks(config, `/opds/search?q=${encodeURIComponent(query)}`);

	for (const book of bookResults) {
		xml += bookEntry(config, {
			...book,
			seriesName: book.seriesTitle
		});
	}

	xml += feedClose();
	return xml;
}

function generateErrorFeed(config: OPDSConfig, message: string): string {
	let xml = xmlHeader();
	xml += feedOpen(config, 'urn:bookshelf:error', 'Error', new Date().toISOString());
	xml += `  <entry>
    <title>Error</title>
    <id>urn:bookshelf:error</id>
    <content type="text">${escapeXml(message)}</content>
    <updated>${new Date().toISOString()}</updated>
  </entry>\n`;
	xml += feedClose();
	return xml;
}

// Get config from environment/settings
export function getOPDSConfig(baseUrl: string): OPDSConfig {
	return {
		baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
		title: 'BookShelf Library',
		author: 'BookShelf'
	};
}
