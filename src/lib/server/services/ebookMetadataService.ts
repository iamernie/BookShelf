import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import { mkdir } from 'fs/promises';
import { getStoragePaths, resolvePathPattern, type PathPatternContext } from './settingsService';
import { createLogger } from './loggerService';
import type AdmZip from 'adm-zip';

const log = createLogger('ebook-metadata');

type IZipEntry = ReturnType<InstanceType<typeof import('adm-zip')>['getEntries']>[number];

// Types for extracted metadata
export interface EbookMetadata {
	title: string | null;
	authors: string[];
	publisher: string | null;
	publishDate: string | null;
	language: string | null;
	description: string | null;
	isbn: string | null;
	subjects: string[];  // genres
	series: string | null;
	seriesNumber: number | null;
	coverImage: Buffer | null;
	coverMimeType: string | null;
}

export interface ExtractedEbook {
	originalFilename: string;
	format: string;
	fileSize: number;
	metadata: EbookMetadata;
	tempPath: string;
}

// Parse OPF content from EPUB
function parseOPF(opfContent: string): EbookMetadata {
	const metadata: EbookMetadata = {
		title: null,
		authors: [],
		publisher: null,
		publishDate: null,
		language: null,
		description: null,
		isbn: null,
		subjects: [],
		series: null,
		seriesNumber: null,
		coverImage: null,
		coverMimeType: null
	};

	// Extract title
	const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
	if (titleMatch) {
		metadata.title = decodeXmlEntities(titleMatch[1].trim());
	}

	// Extract authors (can be multiple)
	const authorMatches = opfContent.matchAll(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi);
	for (const match of authorMatches) {
		metadata.authors.push(decodeXmlEntities(match[1].trim()));
	}

	// Extract publisher
	const publisherMatch = opfContent.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
	if (publisherMatch) {
		metadata.publisher = decodeXmlEntities(publisherMatch[1].trim());
	}

	// Extract publish date
	const dateMatch = opfContent.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
	if (dateMatch) {
		metadata.publishDate = dateMatch[1].trim();
	}

	// Extract language
	const langMatch = opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
	if (langMatch) {
		metadata.language = langMatch[1].trim();
	}

	// Extract description
	const descMatch = opfContent.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/i);
	if (descMatch) {
		metadata.description = decodeXmlEntities(descMatch[1].trim());
	}

	// Extract ISBN from identifier
	const identifierMatches = opfContent.matchAll(/<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/gi);
	for (const match of identifierMatches) {
		const value = match[1].trim();
		// Check if it looks like an ISBN
		const isbnClean = value.replace(/[^0-9X]/gi, '');
		if (isbnClean.length === 10 || isbnClean.length === 13) {
			metadata.isbn = isbnClean;
			break;
		}
	}

	// Extract subjects
	const subjectMatches = opfContent.matchAll(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/gi);
	for (const match of subjectMatches) {
		metadata.subjects.push(decodeXmlEntities(match[1].trim()));
	}

	// Extract series info - Calibre format
	// <meta name="calibre:series" content="Series Name"/>
	// <meta name="calibre:series_index" content="1"/>
	const calibreSeriesMatch = opfContent.match(/<meta[^>]*name="calibre:series"[^>]*content="([^"]+)"/i);
	if (calibreSeriesMatch) {
		metadata.series = decodeXmlEntities(calibreSeriesMatch[1].trim());
	}

	const calibreSeriesIndexMatch = opfContent.match(/<meta[^>]*name="calibre:series_index"[^>]*content="([^"]+)"/i);
	if (calibreSeriesIndexMatch) {
		const index = parseFloat(calibreSeriesIndexMatch[1]);
		if (!isNaN(index)) {
			metadata.seriesNumber = index;
		}
	}

	// Also check for EPUB3 belongs-to-collection
	// <meta property="belongs-to-collection" id="c01">Series Name</meta>
	// <meta refines="#c01" property="collection-type">series</meta>
	// <meta refines="#c01" property="group-position">1</meta>
	if (!metadata.series) {
		const collectionMatch = opfContent.match(/<meta[^>]*property="belongs-to-collection"[^>]*>([^<]+)<\/meta>/i);
		if (collectionMatch) {
			metadata.series = decodeXmlEntities(collectionMatch[1].trim());

			// Try to get position
			const positionMatch = opfContent.match(/<meta[^>]*property="group-position"[^>]*>([^<]+)<\/meta>/i);
			if (positionMatch) {
				const pos = parseFloat(positionMatch[1]);
				if (!isNaN(pos)) {
					metadata.seriesNumber = pos;
				}
			}
		}
	}

	return metadata;
}

function decodeXmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Extract metadata from EPUB file
async function extractEpubMetadata(filePath: string): Promise<EbookMetadata> {
	const AdmZipModule = await import('adm-zip');
	const AdmZip = AdmZipModule.default;
	const zip = new AdmZip(filePath);
	const zipEntries: IZipEntry[] = zip.getEntries();

	let metadata: EbookMetadata = {
		title: null,
		authors: [],
		publisher: null,
		publishDate: null,
		language: null,
		description: null,
		isbn: null,
		subjects: [],
		series: null,
		seriesNumber: null,
		coverImage: null,
		coverMimeType: null
	};

	// Find and parse container.xml to get OPF path
	const containerEntry = zipEntries.find((e: IZipEntry) => e.entryName.endsWith('container.xml'));
	let opfPath = '';

	if (containerEntry) {
		const containerXml = containerEntry.getData().toString('utf8');
		const rootfileMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
		if (rootfileMatch) {
			opfPath = rootfileMatch[1];
		}
	}

	// Find OPF file
	const opfEntry = zipEntries.find((e: IZipEntry) =>
		opfPath ? e.entryName === opfPath : e.entryName.endsWith('.opf')
	);

	if (opfEntry) {
		const opfContent = opfEntry.getData().toString('utf8');
		metadata = parseOPF(opfContent);

		// Try to find cover image reference in OPF
		const coverIdMatch = opfContent.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i) ||
			opfContent.match(/<item[^>]*id="cover[^"]*"[^>]*href="([^"]+)"/i);

		if (coverIdMatch) {
			const coverId = coverIdMatch[1];
			// Find the item with this id
			const coverItemMatch = opfContent.match(new RegExp(`<item[^>]*id="${coverId}"[^>]*href="([^"]+)"`, 'i'));
			if (coverItemMatch) {
				const coverPath = coverItemMatch[1];
				const opfDir = path.dirname(opfPath || opfEntry.entryName);
				const fullCoverPath = opfDir ? `${opfDir}/${coverPath}` : coverPath;

				const coverEntry = zipEntries.find((e: IZipEntry) =>
					e.entryName === fullCoverPath ||
					e.entryName.endsWith(coverPath)
				);

				if (coverEntry) {
					metadata.coverImage = coverEntry.getData();
					const ext = path.extname(coverPath).toLowerCase();
					metadata.coverMimeType = ext === '.png' ? 'image/png' :
						ext === '.gif' ? 'image/gif' : 'image/jpeg';
				}
			}
		}

		// Fallback: look for common cover image names
		if (!metadata.coverImage) {
			const coverPatterns = ['cover.jpg', 'cover.jpeg', 'cover.png', 'Cover.jpg', 'Cover.jpeg', 'Cover.png'];
			for (const pattern of coverPatterns) {
				const coverEntry = zipEntries.find((e: IZipEntry) => e.entryName.toLowerCase().endsWith(pattern.toLowerCase()));
				if (coverEntry) {
					metadata.coverImage = coverEntry.getData();
					metadata.coverMimeType = pattern.endsWith('.png') ? 'image/png' : 'image/jpeg';
					break;
				}
			}
		}
	}

	return metadata;
}

// Extract metadata from PDF (basic - just filename parsing)
async function extractPdfMetadata(filePath: string, filename: string): Promise<EbookMetadata> {
	// PDF metadata extraction would require pdf-parse or similar
	// For now, just parse the filename
	return parseFilename(filename);
}

// Extract metadata from CBZ/CBR
async function extractCbzMetadata(filePath: string, filename: string): Promise<EbookMetadata> {
	const AdmZipModule = await import('adm-zip');
	const AdmZip = AdmZipModule.default;

	try {
		const zip = new AdmZip(filePath);
		const zipEntries: IZipEntry[] = zip.getEntries();

		const metadata = parseFilename(filename);

		// Look for ComicInfo.xml
		const comicInfoEntry = zipEntries.find((e: IZipEntry) => e.entryName.toLowerCase() === 'comicinfo.xml');
		if (comicInfoEntry) {
			const xml = comicInfoEntry.getData().toString('utf8');

			const titleMatch = xml.match(/<Title>([^<]+)<\/Title>/i);
			if (titleMatch) metadata.title = decodeXmlEntities(titleMatch[1]);

			const writerMatch = xml.match(/<Writer>([^<]+)<\/Writer>/i);
			if (writerMatch) metadata.authors = [decodeXmlEntities(writerMatch[1])];

			const publisherMatch = xml.match(/<Publisher>([^<]+)<\/Publisher>/i);
			if (publisherMatch) metadata.publisher = decodeXmlEntities(publisherMatch[1]);

			const summaryMatch = xml.match(/<Summary>([^<]+)<\/Summary>/i);
			if (summaryMatch) metadata.description = decodeXmlEntities(summaryMatch[1]);
		}

		// Get first image as cover
		const imageEntry = zipEntries
			.filter((e: IZipEntry) => /\.(jpg|jpeg|png|gif)$/i.test(e.entryName))
			.sort((a: IZipEntry, b: IZipEntry) => a.entryName.localeCompare(b.entryName))[0];

		if (imageEntry) {
			metadata.coverImage = imageEntry.getData();
			const ext = path.extname(imageEntry.entryName).toLowerCase();
			metadata.coverMimeType = ext === '.png' ? 'image/png' :
				ext === '.gif' ? 'image/gif' : 'image/jpeg';
		}

		return metadata;
	} catch {
		return parseFilename(filename);
	}
}

// Parse metadata from filename as fallback
function parseFilename(filename: string): EbookMetadata {
	const metadata: EbookMetadata = {
		title: null,
		authors: [],
		publisher: null,
		publishDate: null,
		language: null,
		description: null,
		isbn: null,
		subjects: [],
		series: null,
		seriesNumber: null,
		coverImage: null,
		coverMimeType: null
	};

	// Remove extension
	let name = filename.replace(/\.(epub|pdf|cbz|cbr|mobi|azw3?)$/i, '');

	// Common patterns:
	// "Title - Author"
	// "Author - Title"
	// "Title (Series #1)"
	// "Author - Title (Series #1)"
	// "Series Name Book 1 - Title - Author"

	// Try to extract series info from patterns like "(Series Name #1)" or "(Series Name, Book 1)"
	const seriesMatch = name.match(/\(([^)]+?)\s*[#,]\s*(\d+(?:\.\d+)?)\s*\)/) ||
		name.match(/\[([^\]]+?)\s*[#,]\s*(\d+(?:\.\d+)?)\s*\]/);
	if (seriesMatch) {
		metadata.series = seriesMatch[1].trim();
		metadata.seriesNumber = parseFloat(seriesMatch[2]);
		// Remove series info from name for cleaner title
		name = name.replace(seriesMatch[0], '').trim();
	}

	// Try to extract author from "Author - Title" or "Title - Author" pattern
	const dashParts = name.split(' - ');
	if (dashParts.length >= 2) {
		// Assume "Author - Title" if first part is shorter
		if (dashParts[0].length < dashParts[1].length) {
			metadata.authors = [dashParts[0].trim()];
			metadata.title = dashParts.slice(1).join(' - ').trim();
		} else {
			metadata.title = dashParts[0].trim();
			metadata.authors = [dashParts.slice(1).join(' - ').trim()];
		}
	} else {
		metadata.title = name.trim();
	}

	// Clean up title - remove any remaining series patterns
	if (metadata.title) {
		metadata.title = metadata.title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, '').trim();
		metadata.title = metadata.title.replace(/\s*\[[^\]]*#\d+[^\]]*\]\s*$/, '').trim();
	}

	return metadata;
}

// Get format from extension
function getFormat(filename: string): string {
	const ext = path.extname(filename).toLowerCase();
	switch (ext) {
		case '.epub': return 'epub';
		case '.pdf': return 'pdf';
		case '.mobi': return 'mobi';
		case '.azw': return 'azw';
		case '.azw3': return 'azw3';
		case '.cbz': return 'cbz';
		case '.cbr': return 'cbr';
		default: return 'unknown';
	}
}

// Main extraction function
export async function extractEbookMetadata(
	filePath: string,
	originalFilename: string
): Promise<ExtractedEbook> {
	const format = getFormat(originalFilename);
	const stats = await import('fs/promises').then(fs => fs.stat(filePath));

	let metadata: EbookMetadata;

	switch (format) {
		case 'epub':
			metadata = await extractEpubMetadata(filePath);
			break;
		case 'cbz':
		case 'cbr':
			metadata = await extractCbzMetadata(filePath, originalFilename);
			break;
		case 'pdf':
			metadata = await extractPdfMetadata(filePath, originalFilename);
			break;
		default:
			metadata = parseFilename(originalFilename);
	}

	// Fallback to filename if no title extracted
	if (!metadata.title) {
		const fallback = parseFilename(originalFilename);
		metadata.title = fallback.title;
		if (metadata.authors.length === 0) {
			metadata.authors = fallback.authors;
		}
	}

	return {
		originalFilename,
		format,
		fileSize: stats.size,
		metadata,
		tempPath: filePath
	};
}

// Context for path pattern resolution
export interface SaveContext {
	author?: string;
	series?: string;
	title: string;
}

// Save cover image and return path
export async function saveCoverImage(
	coverBuffer: Buffer,
	mimeType: string,
	context: SaveContext
): Promise<string> {
	const { coversPath, coverPathPattern } = await getStoragePaths();

	const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/gif' ? '.gif' : '.jpg';
	const hash = randomBytes(4).toString('hex');
	const baseFilename = `${context.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50)}_${hash}${ext}`;

	log.debug(`Saving cover: title="${context.title}", author="${context.author}", filename="${baseFilename}"`);

	// Resolve the path pattern
	const patternContext: PathPatternContext = {
		author: context.author,
		series: context.series,
		title: context.title,
		filename: baseFilename
	};

	const resolvedPath = resolvePathPattern(coverPathPattern, patternContext);
	const fullPath = path.join(coversPath, resolvedPath);
	const directory = path.dirname(fullPath);

	log.debug(`Cover path: resolved="${resolvedPath}", full="${fullPath}", dir="${directory}"`);

	try {
		// Create directory structure
		await mkdir(directory, { recursive: true });

		// Write the file
		await import('fs/promises').then(fs => fs.writeFile(fullPath, coverBuffer));

		log.info(`Cover saved: ${fullPath} (${coverBuffer.length} bytes)`);
	} catch (err) {
		log.error(`Failed to save cover: ${fullPath}`, { error: err });
		throw err;
	}

	// Return web-accessible path
	const webBasePath = coversPath.startsWith('./static') ? coversPath.slice(8) : '/covers';
	return `${webBasePath}/${resolvedPath}`;
}

// Move ebook to permanent storage
export async function saveEbookFile(
	tempPath: string,
	originalFilename: string,
	context: SaveContext
): Promise<string> {
	const { ebooksPath, ebookPathPattern } = await getStoragePaths();

	const ext = path.extname(originalFilename);
	const hash = randomBytes(4).toString('hex');
	const safeName = path.basename(originalFilename, ext)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.substring(0, 50);
	const baseFilename = `${safeName}_${hash}${ext}`;

	// Resolve the path pattern
	const patternContext: PathPatternContext = {
		author: context.author,
		series: context.series,
		title: context.title,
		format: ext.replace('.', '').toUpperCase(),
		filename: baseFilename
	};

	const resolvedPath = resolvePathPattern(ebookPathPattern, patternContext);
	const fullPath = path.join(ebooksPath, resolvedPath);
	const directory = path.dirname(fullPath);

	// Create directory structure
	await mkdir(directory, { recursive: true });

	const fs = await import('fs/promises');
	await fs.copyFile(tempPath, fullPath);

	// Clean up temp file
	try {
		await fs.unlink(tempPath);
	} catch {
		// Ignore cleanup errors
	}

	// Return web-accessible path
	const webBasePath = ebooksPath.startsWith('./static') ? ebooksPath.slice(8) : '/ebooks';
	return `${webBasePath}/${resolvedPath}`;
}
