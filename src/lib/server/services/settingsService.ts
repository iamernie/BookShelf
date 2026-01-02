import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Default settings with their metadata
export const DEFAULT_SETTINGS = {
	// Storage paths
	'storage.covers_path': {
		value: './static/covers',
		type: 'string',
		category: 'storage',
		label: 'Cover Images Path',
		description: 'Directory where book cover images are stored'
	},
	'storage.ebooks_path': {
		value: './static/ebooks',
		type: 'string',
		category: 'storage',
		label: 'Ebooks Path',
		description: 'Directory where ebook files are stored'
	},
	'storage.temp_path': {
		value: '/tmp/bookshelf-uploads',
		type: 'string',
		category: 'storage',
		label: 'Temporary Upload Path',
		description: 'Directory for temporary file uploads during import'
	},
	'storage.ebook_path_pattern': {
		value: '{author}/<{series}/>{title}',
		type: 'string',
		category: 'storage',
		label: 'Ebook Path Pattern',
		description: 'Pattern for organizing ebooks. Placeholders: {author}, {series}, {seriesIndex}, {title}, {year}, {format}. Use <...> for optional sections.'
	},
	'storage.cover_path_pattern': {
		value: '{author}/<{series}/>{title}',
		type: 'string',
		category: 'storage',
		label: 'Cover Path Pattern',
		description: 'Pattern for organizing covers. Same placeholders as ebook pattern.'
	},
	'storage.audiobooks_path': {
		value: './data/audiobooks',
		type: 'string',
		category: 'storage',
		label: 'Audiobooks Path',
		description: 'Directory where audiobook files are stored'
	},
	'storage.audiobook_path_pattern': {
		value: '{author}/<{series}/>{title}',
		type: 'string',
		category: 'storage',
		label: 'Audiobook Path Pattern',
		description: 'Pattern for organizing audiobooks. Same placeholders as ebook pattern.'
	},
	'storage.auto_organize': {
		value: 'false',
		type: 'boolean',
		category: 'storage',
		label: 'Auto-Organize Files',
		description: 'Automatically move/rename files when metadata is updated'
	},
	// Library settings
	'library.name': {
		value: 'BookShelf',
		type: 'string',
		category: 'library',
		label: 'Library Name',
		description: 'Name displayed in the header and OPDS feed'
	},
	'library.default_status': {
		value: '1',
		type: 'string',
		category: 'library',
		label: 'Default Status',
		description: 'Default reading status for new books (Unread by default)'
	},
	'library.enable_public_library': {
		value: 'true',
		type: 'boolean',
		category: 'library',
		label: 'Enable Public Library',
		description: 'Show the shared public library. When disabled, only personal libraries are available.'
	},
	// Registration settings
	'registration.allow_signup': {
		value: 'false',
		type: 'boolean',
		category: 'registration',
		label: 'Allow Public Signup',
		description: 'Allow new users to register accounts'
	},
	'registration.require_email_verification': {
		value: 'true',
		type: 'boolean',
		category: 'registration',
		label: 'Require Email Verification',
		description: 'New users must verify their email before accessing the library'
	},
	'registration.default_role': {
		value: 'member',
		type: 'select',
		category: 'registration',
		label: 'Default Role for New Users',
		description: 'Role assigned to newly registered users',
		options: [
			{ value: 'member', label: 'Member' },
			{ value: 'viewer', label: 'Viewer' },
			{ value: 'guest', label: 'Guest' }
		]
	},
	'registration.require_admin_approval': {
		value: 'false',
		type: 'boolean',
		category: 'registration',
		label: 'Require Admin Approval',
		description: 'New registrations must be approved by an admin before activation'
	},
	'registration.require_invite_code': {
		value: 'false',
		type: 'boolean',
		category: 'registration',
		label: 'Require Invite Code',
		description: 'New users must enter a valid invite code to register'
	},
	// Display settings
	'display.books_per_page': {
		value: '24',
		type: 'number',
		category: 'display',
		label: 'Books Per Page',
		description: 'Number of books to show per page in library view'
	},
	'display.default_sort': {
		value: 'title',
		type: 'select',
		category: 'display',
		label: 'Default Sort',
		description: 'Default sorting for book lists',
		options: [
			{ value: 'title', label: 'Title' },
			{ value: 'author', label: 'Author' },
			{ value: 'rating', label: 'Rating' },
			{ value: 'createdAt', label: 'Date Added' },
			{ value: 'publishYear', label: 'Publish Year' }
		]
	},
	'display.default_view': {
		value: 'grid',
		type: 'select',
		category: 'display',
		label: 'Default View',
		description: 'Default view mode for book lists',
		options: [
			{ value: 'grid', label: 'Grid' },
			{ value: 'list', label: 'List' },
			{ value: 'compact', label: 'Compact' }
		]
	},
	// OPDS settings
	'opds.enabled': {
		value: 'true',
		type: 'boolean',
		category: 'opds',
		label: 'Enable OPDS',
		description: 'Enable OPDS catalog for e-reader access'
	},
	'opds.items_per_page': {
		value: '50',
		type: 'number',
		category: 'opds',
		label: 'OPDS Items Per Page',
		description: 'Number of items per page in OPDS feeds'
	},
	// Import settings
	'import.auto_detect_series': {
		value: 'true',
		type: 'boolean',
		category: 'import',
		label: 'Auto-detect Series',
		description: 'Attempt to detect series from book titles during import'
	},
	'import.download_covers': {
		value: 'true',
		type: 'boolean',
		category: 'import',
		label: 'Download Covers',
		description: 'Automatically download cover images during import'
	},
	// Metadata provider settings
	'metadata.googlebooks_enabled': {
		value: 'true',
		type: 'boolean',
		category: 'metadata',
		label: 'Google Books',
		description: 'Enable Google Books API for metadata lookups'
	},
	'metadata.openlibrary_enabled': {
		value: 'true',
		type: 'boolean',
		category: 'metadata',
		label: 'Open Library',
		description: 'Enable Open Library API for metadata lookups'
	},
	'metadata.goodreads_enabled': {
		value: 'true',
		type: 'boolean',
		category: 'metadata',
		label: 'Goodreads',
		description: 'Enable Goodreads scraping for metadata (ratings, reviews, series)'
	},
	'metadata.hardcover_enabled': {
		value: 'false',
		type: 'boolean',
		category: 'metadata',
		label: 'Hardcover',
		description: 'Enable Hardcover API for metadata (requires API key)'
	},
	'metadata.hardcover_api_key': {
		value: '',
		type: 'string',
		category: 'metadata',
		label: 'Hardcover API Key',
		description: 'API key from hardcover.app/account/api (required for Hardcover)'
	},
	'metadata.amazon_enabled': {
		value: 'false',
		type: 'boolean',
		category: 'metadata',
		label: 'Amazon',
		description: 'Enable Amazon for metadata lookups (web scraping, may be unreliable)'
	},
	'metadata.amazon_domain': {
		value: 'com',
		type: 'select',
		category: 'metadata',
		label: 'Amazon Domain',
		description: 'Amazon regional domain to use for lookups',
		options: [
			{ value: 'com', label: 'United States (.com)' },
			{ value: 'co.uk', label: 'United Kingdom (.co.uk)' },
			{ value: 'de', label: 'Germany (.de)' },
			{ value: 'fr', label: 'France (.fr)' },
			{ value: 'it', label: 'Italy (.it)' },
			{ value: 'es', label: 'Spain (.es)' },
			{ value: 'ca', label: 'Canada (.ca)' },
			{ value: 'com.au', label: 'Australia (.com.au)' },
			{ value: 'co.jp', label: 'Japan (.co.jp)' },
			{ value: 'in', label: 'India (.in)' }
		]
	},
	'metadata.comicvine_enabled': {
		value: 'false',
		type: 'boolean',
		category: 'metadata',
		label: 'Comic Vine',
		description: 'Enable Comic Vine for comic/graphic novel metadata (requires API key)'
	},
	'metadata.comicvine_api_key': {
		value: '',
		type: 'string',
		category: 'metadata',
		label: 'Comic Vine API Key',
		description: 'API key from comicvine.gamespot.com/api (required for Comic Vine)'
	},
	// Email/SMTP settings
	'email.smtp_host': {
		value: '',
		type: 'string',
		category: 'email',
		label: 'SMTP Host',
		description: 'SMTP server hostname (e.g., smtp.gmail.com, smtp.mailgun.org)'
	},
	'email.smtp_port': {
		value: '587',
		type: 'number',
		category: 'email',
		label: 'SMTP Port',
		description: 'SMTP server port (587 for TLS, 465 for SSL, 25 for plain)'
	},
	'email.smtp_secure': {
		value: 'false',
		type: 'boolean',
		category: 'email',
		label: 'Use SSL/TLS',
		description: 'Use implicit TLS (port 465). Leave off for STARTTLS (port 587)'
	},
	'email.smtp_user': {
		value: '',
		type: 'string',
		category: 'email',
		label: 'SMTP Username',
		description: 'Username for SMTP authentication (often your email address)'
	},
	'email.smtp_pass': {
		value: '',
		type: 'password',
		category: 'email',
		label: 'SMTP Password',
		description: 'Password or app-specific password for SMTP authentication'
	},
	'email.from_address': {
		value: 'BookShelf <noreply@bookshelf.local>',
		type: 'string',
		category: 'email',
		label: 'From Address',
		description: 'Email address shown as sender (e.g., BookShelf <noreply@example.com>)'
	},
	// UI settings
	'ui.show_whats_new_modal': {
		value: 'true',
		type: 'boolean',
		category: 'ui',
		label: 'Show What\'s New Modal',
		description: 'Display the What\'s New popup when the app is updated to a new version (admin users only)'
	},
	// Notification settings (ntfy)
	'notifications.ntfy_enabled': {
		value: 'false',
		type: 'boolean',
		category: 'notifications',
		label: 'Enable ntfy Notifications',
		description: 'Enable push notifications via ntfy server'
	},
	'notifications.ntfy_url': {
		value: 'https://ntfy.sh',
		type: 'string',
		category: 'notifications',
		label: 'ntfy Server URL',
		description: 'URL of your ntfy server (e.g., https://ntfy.sh or https://ntfy.yourdomain.com)'
	},
	'notifications.ntfy_admin_topic': {
		value: '',
		type: 'string',
		category: 'notifications',
		label: 'Admin Topic',
		description: 'Topic for system notifications (backups, updates). Leave empty to disable admin notifications.'
	}
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

// Get a single setting value
export async function getSetting(key: SettingKey): Promise<string> {
	const result = await db.select().from(settings).where(eq(settings.key, key)).get();

	if (result?.value !== null && result?.value !== undefined) {
		return result.value;
	}

	return DEFAULT_SETTINGS[key].value;
}

// Get a setting as a specific type
export async function getSettingAs<T extends string | number | boolean>(
	key: SettingKey,
	type: 'string' | 'number' | 'boolean'
): Promise<T> {
	const value = await getSetting(key);

	switch (type) {
		case 'number':
			return parseInt(value, 10) as T;
		case 'boolean':
			return (value === 'true' || value === '1') as T;
		default:
			return value as T;
	}
}

// Get all settings in a category
export async function getSettingsByCategory(category: string): Promise<Record<string, string>> {
	const result: Record<string, string> = {};

	// Get defaults for this category
	for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
		if (meta.category === category) {
			result[key] = meta.value;
		}
	}

	// Override with stored values
	const stored = await db.select().from(settings).all();
	for (const setting of stored) {
		if (setting.category === category && setting.value !== null) {
			result[setting.key] = setting.value;
		}
	}

	return result;
}

// Get all settings with metadata
export async function getAllSettings(): Promise<Array<{
	key: string;
	value: string;
	type: string;
	category: string;
	label: string;
	description: string;
}>> {
	const stored = await db.select().from(settings).all();
	const storedMap = new Map(stored.map(s => [s.key, s.value]));

	return Object.entries(DEFAULT_SETTINGS).map(([key, meta]) => ({
		key,
		value: storedMap.get(key) ?? meta.value,
		type: meta.type,
		category: meta.category,
		label: meta.label,
		description: meta.description
	}));
}

// Set a single setting
export async function setSetting(key: SettingKey, value: string): Promise<void> {
	const meta = DEFAULT_SETTINGS[key];

	await db.insert(settings)
		.values({
			key,
			value,
			type: meta.type,
			category: meta.category,
			label: meta.label,
			description: meta.description,
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: settings.key,
			set: {
				value,
				updatedAt: new Date().toISOString()
			}
		});
}

// Set multiple settings at once
export async function setSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
	for (const [key, value] of Object.entries(values)) {
		if (key in DEFAULT_SETTINGS && value !== undefined) {
			await setSetting(key as SettingKey, value);
		}
	}
}

// Initialize default settings in database
export async function initializeSettings(): Promise<void> {
	for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
		const existing = await db.select().from(settings).where(eq(settings.key, key)).get();

		if (!existing) {
			await db.insert(settings).values({
				key,
				value: meta.value,
				type: meta.type,
				category: meta.category,
				label: meta.label,
				description: meta.description,
				isSystem: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});
		}
	}
}

// Get metadata provider settings
export async function getMetadataProviderSettings(): Promise<{
	googlebooks: { enabled: boolean };
	openlibrary: { enabled: boolean };
	goodreads: { enabled: boolean };
	hardcover: { enabled: boolean; apiKey: string };
	amazon: { enabled: boolean; domain: string };
	comicvine: { enabled: boolean; apiKey: string };
}> {
	const [
		googleEnabled,
		openLibraryEnabled,
		goodreadsEnabled,
		hardcoverEnabled,
		hardcoverApiKey,
		amazonEnabled,
		amazonDomain,
		comicvineEnabled,
		comicvineApiKey
	] = await Promise.all([
		getSettingAs<boolean>('metadata.googlebooks_enabled', 'boolean'),
		getSettingAs<boolean>('metadata.openlibrary_enabled', 'boolean'),
		getSettingAs<boolean>('metadata.goodreads_enabled', 'boolean'),
		getSettingAs<boolean>('metadata.hardcover_enabled', 'boolean'),
		getSetting('metadata.hardcover_api_key'),
		getSettingAs<boolean>('metadata.amazon_enabled', 'boolean'),
		getSetting('metadata.amazon_domain'),
		getSettingAs<boolean>('metadata.comicvine_enabled', 'boolean'),
		getSetting('metadata.comicvine_api_key')
	]);

	return {
		googlebooks: { enabled: googleEnabled as boolean },
		openlibrary: { enabled: openLibraryEnabled as boolean },
		goodreads: { enabled: goodreadsEnabled as boolean },
		hardcover: { enabled: hardcoverEnabled as boolean, apiKey: hardcoverApiKey },
		amazon: { enabled: amazonEnabled as boolean, domain: amazonDomain },
		comicvine: { enabled: comicvineEnabled as boolean, apiKey: comicvineApiKey }
	};
}

// Get email/SMTP settings (environment variables take precedence)
export async function getEmailSettings(): Promise<{
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	from: string;
	configuredViaEnv: boolean;
}> {
	// Check if environment variables are set
	const envHost = process.env.SMTP_HOST;
	const envConfigured = !!envHost;

	if (envConfigured) {
		// Use environment variables
		return {
			host: envHost,
			port: parseInt(process.env.SMTP_PORT || '587', 10),
			secure: process.env.SMTP_SECURE === 'true',
			user: process.env.SMTP_USER || '',
			pass: process.env.SMTP_PASS || '',
			from: process.env.SMTP_FROM || 'BookShelf <noreply@bookshelf.local>',
			configuredViaEnv: true
		};
	}

	// Use database settings
	const [host, port, secure, user, pass, from] = await Promise.all([
		getSetting('email.smtp_host'),
		getSetting('email.smtp_port'),
		getSettingAs<boolean>('email.smtp_secure', 'boolean'),
		getSetting('email.smtp_user'),
		getSetting('email.smtp_pass'),
		getSetting('email.from_address')
	]);

	return {
		host,
		port: parseInt(port, 10) || 587,
		secure: secure as boolean,
		user,
		pass,
		from,
		configuredViaEnv: false
	};
}

// Get storage paths helper
export async function getStoragePaths(): Promise<{
	coversPath: string;
	ebooksPath: string;
	tempPath: string;
	ebookPathPattern: string;
	coverPathPattern: string;
}> {
	const [coversPath, ebooksPath, tempPath, ebookPathPattern, coverPathPattern] = await Promise.all([
		getSetting('storage.covers_path'),
		getSetting('storage.ebooks_path'),
		getSetting('storage.temp_path'),
		getSetting('storage.ebook_path_pattern'),
		getSetting('storage.cover_path_pattern')
	]);

	return { coversPath, ebooksPath, tempPath, ebookPathPattern, coverPathPattern };
}

// File path pattern context for resolving patterns
export interface PathPatternContext {
	author?: string;
	authors?: string;        // All authors comma-separated
	series?: string;
	seriesIndex?: string;    // Series number (e.g., "1", "2.5")
	title?: string;
	subtitle?: string;
	year?: string;           // Publication year
	format?: string;
	genre?: string;
	publisher?: string;
	language?: string;
	isbn?: string;
	filename?: string;
}

// Sanitize a string for use in file paths
function sanitizePathComponent(str: string): string {
	return str
		.toLowerCase()
		.replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
		.replace(/\s+/g, '_')         // Replace spaces with underscores
		.replace(/_{2,}/g, '_')       // Collapse multiple underscores
		.replace(/^_|_$/g, '')        // Remove leading/trailing underscores
		.substring(0, 100);           // Limit length
}

// Resolve a path pattern with context values
export function resolvePathPattern(pattern: string, context: PathPatternContext): string {
	let result = pattern;

	// Replace each placeholder with its sanitized value or empty string
	const replacements: Record<string, string | undefined> = {
		'{author}': context.author,
		'{authors}': context.authors,
		'{series}': context.series,
		'{seriesIndex}': context.seriesIndex,
		'{seriesNum}': context.seriesIndex, // Alias
		'{title}': context.title,
		'{subtitle}': context.subtitle,
		'{year}': context.year,
		'{format}': context.format,
		'{genre}': context.genre,
		'{publisher}': context.publisher,
		'{language}': context.language,
		'{isbn}': context.isbn,
		'{filename}': context.filename
	};

	for (const [placeholder, value] of Object.entries(replacements)) {
		if (result.includes(placeholder)) {
			const sanitized = value ? sanitizePathComponent(value) : '';
			result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), sanitized);
		}
	}

	// Handle optional blocks: <...> sections are removed if they contain unresolved/empty placeholders
	// e.g., "<{series}/>" becomes "" if series is empty, or "fantasy/" if series is "Fantasy"
	result = result.replace(/<([^>]*)>/g, (match, content) => {
		// Check if the content still has empty segments from unresolved placeholders
		const cleaned = content.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').trim();
		return cleaned ? cleaned : '';
	});

	// Clean up any empty path segments (e.g., "author//title" becomes "author/title")
	result = result
		.replace(/\/+/g, '/')
		.replace(/^\/|\/$/g, '');

	// If the pattern resulted in an empty string, use filename as fallback
	if (!result && context.filename) {
		result = sanitizePathComponent(context.filename);
	}

	return result;
}

// Get list of available placeholders for documentation
export function getAvailablePlaceholders(): Array<{ placeholder: string; description: string; example: string }> {
	return [
		{ placeholder: '{author}', description: 'Primary author name', example: 'brandon_sanderson' },
		{ placeholder: '{authors}', description: 'All authors, comma-separated', example: 'brandon_sanderson_brian_mcclellan' },
		{ placeholder: '{series}', description: 'Primary series name', example: 'the_stormlight_archive' },
		{ placeholder: '{seriesIndex}', description: 'Book number in series', example: '1' },
		{ placeholder: '{title}', description: 'Book title', example: 'the_way_of_kings' },
		{ placeholder: '{subtitle}', description: 'Book subtitle', example: 'part_one' },
		{ placeholder: '{year}', description: 'Publication year', example: '2010' },
		{ placeholder: '{format}', description: 'File format (epub, pdf, etc.)', example: 'epub' },
		{ placeholder: '{genre}', description: 'Primary genre', example: 'fantasy' },
		{ placeholder: '{publisher}', description: 'Publisher name', example: 'tor_books' },
		{ placeholder: '{language}', description: 'Language code', example: 'en' },
		{ placeholder: '{isbn}', description: 'ISBN-13', example: '9780765326355' },
		{ placeholder: '{filename}', description: 'Original filename (sanitized)', example: 'the_way_of_kings' }
	];
}
