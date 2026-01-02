import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================
// Core Tables
// ============================================

export const books = sqliteTable('books', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	rating: real('rating'),
	coverImageUrl: text('coverImageUrl'),
	originalCoverUrl: text('originalCoverUrl'),
	bookNum: integer('bookNum'),
	bookNumEnd: integer('bookNumEnd'),
	summary: text('summary'),
	comments: text('comments'),
	releaseDate: text('releaseDate'), // ISO date string
	startReadingDate: text('startReadingDate'),
	completedDate: text('completedDate'),
	isbn10: text('isbn10'),
	isbn13: text('isbn13'),
	asin: text('asin'),
	goodreadsId: text('goodreadsId'),
	googleBooksId: text('googleBooksId'),
	pageCount: integer('pageCount'),
	publisher: text('publisher'),
	publishYear: integer('publishYear'),
	language: text('language').default('English'),
	edition: text('edition'),
	purchasePrice: real('purchasePrice'),
	// DNF (Did Not Finish) tracking
	dnfPage: integer('dnfPage'),
	dnfPercent: integer('dnfPercent'),
	dnfReason: text('dnfReason'),
	dnfDate: text('dnfDate'),
	// Ebook support
	ebookPath: text('ebookPath'),
	ebookFormat: text('ebookFormat'),
	readingProgress: text('readingProgress'), // JSON
	lastReadAt: text('lastReadAt'),
	// Library type: 'personal' or 'public'
	libraryType: text('libraryType').default('personal'),
	// Owner of the book (per-user library)
	ownerId: integer('ownerId').references(() => users.id),
	// Foreign keys
	statusId: integer('statusId').references(() => statuses.id),
	genreId: integer('genreId').references(() => genres.id),
	formatId: integer('formatId').references(() => formats.id),
	narratorId: integer('narratorId').references(() => narrators.id),
	// Legacy single author/series (for backwards compat)
	authorId: integer('authorId').references(() => authors.id),
	seriesId: integer('seriesId').references(() => series.id),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const authors = sqliteTable('authors', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	bio: text('bio'),
	birthDate: text('birthDate'),
	deathDate: text('deathDate'),
	birthPlace: text('birthPlace'),
	photoUrl: text('photoUrl'),
	website: text('website'),
	wikipediaUrl: text('wikipediaUrl'),
	comments: text('comments'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const series = sqliteTable('series', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	description: text('description'),
	numBooks: integer('numBooks'),
	comments: text('comments'),
	statusId: integer('statusId').references(() => seriesStatuses.id),
	genreId: integer('genreId').references(() => genres.id),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const genres = sqliteTable('genres', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'),
	color: text('color'),
	icon: text('icon'),
	slug: text('slug').unique(),
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const statuses = sqliteTable('statuses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	key: text('key').unique(), // READ, CURRENT, NEXT, DNF, WISHLIST, PARKED
	isSystem: integer('isSystem', { mode: 'boolean' }).default(false),
	color: text('color').default('#6c757d'),
	icon: text('icon').default('fas fa-bookmark'),
	sortOrder: integer('sortOrder').default(0),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const seriesStatuses = sqliteTable('seriesstatuses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	key: text('key'),
	isSystem: integer('isSystem', { mode: 'boolean' }).default(false),
	color: text('color').default('#6c757d'),
	icon: text('icon').default('fas fa-bookmark'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const narrators = sqliteTable('narrators', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	bio: text('bio'),
	birthDate: text('birthDate'),
	deathDate: text('deathDate'),
	birthPlace: text('birthPlace'),
	photoUrl: text('photoUrl'),
	website: text('website'),
	wikipediaUrl: text('wikipediaUrl'),
	comments: text('comments'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const formats = sqliteTable('formats', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	icon: text('icon').default('book'),
	color: text('color').default('#6c757d'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	color: text('color').default('#6c757d'),
	icon: text('icon'),
	isSystem: integer('isSystem', { mode: 'boolean' }).default(false),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	email: text('email').notNull().unique(),
	password: text('password').notNull(),
	role: text('role').default('member'), // admin, librarian, member, viewer, guest
	firstName: text('firstName'),
	lastName: text('lastName'),
	// Account security
	failedLoginAttempts: integer('failedLoginAttempts').default(0),
	lockoutUntil: text('lockoutUntil'),
	// Password reset
	resetToken: text('resetToken'),
	resetTokenExpires: text('resetTokenExpires'),
	// Email verification
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	emailVerificationToken: text('emailVerificationToken'),
	emailVerificationExpires: text('emailVerificationExpires'),
	// Account approval
	approvalStatus: text('approvalStatus').default('approved'), // pending, approved, rejected
	approvedBy: integer('approvedBy'),
	approvedAt: text('approvedAt'),
	inviteCodeUsed: text('inviteCodeUsed'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value'),
	type: text('type').default('string'), // string, number, boolean, json
	category: text('category'),
	label: text('label'),
	description: text('description'),
	isSystem: integer('isSystem', { mode: 'boolean' }).default(false),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const readingGoals = sqliteTable('readinggoals', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	year: integer('year').notNull(),
	targetBooks: integer('targetBooks').default(12),
	booksRead: integer('booksRead').default(0),
	isActive: integer('isActive', { mode: 'boolean' }).default(true),
	challengeType: text('challengeType'), // books, genres, authors, formats, pages, monthly
	name: text('name'),
	icon: text('icon'), // Custom icon override (lucide icon name)
	targetGenres: integer('targetGenres'),
	targetAuthors: integer('targetAuthors'),
	targetFormats: integer('targetFormats'),
	targetPages: integer('targetPages'),
	targetMonthly: integer('targetMonthly'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const sessions = sqliteTable('Sessions', {
	sid: text('sid').primaryKey(),
	expires: text('expires'),
	data: text('data'),
	createdAt: text('createdAt').notNull().default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').notNull().default('CURRENT_TIMESTAMP')
});

export const inviteCodes = sqliteTable('invitecodes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	label: text('label'), // Description for admin reference
	maxUses: integer('maxUses'), // null = unlimited
	usedCount: integer('usedCount').default(0),
	expiresAt: text('expiresAt'), // null = never expires
	isActive: integer('isActive', { mode: 'boolean' }).default(true),
	createdBy: integer('createdBy').references(() => users.id),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const magicShelves = sqliteTable('magicshelves', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'),
	icon: text('icon').default('bookmark'),
	iconColor: text('iconColor').default('#6c757d'),
	filterJson: text('filterJson').notNull(), // JSON-encoded filter rules
	sortField: text('sortField').default('title'),
	sortOrder: text('sortOrder').default('asc'),
	isPublic: integer('isPublic', { mode: 'boolean' }).default(false),
	userId: integer('userId').references(() => users.id),
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// BookDrop Tables
// ============================================

export const bookdropQueue = sqliteTable('bookdrop_queue', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').references(() => users.id),
	filename: text('filename').notNull(),
	filePath: text('filePath').notNull(),
	fileSize: integer('fileSize'),
	fileHash: text('fileHash'), // For duplicate detection
	source: text('source').default('upload'), // upload, watched_folder
	status: text('status').default('pending'), // pending, processing, imported, failed, skipped
	bookId: integer('bookId').references(() => books.id), // Link to created book after import
	// Extracted metadata (JSON)
	metadata: text('metadata'),
	// Cover image (stored as base64 or path)
	coverData: text('coverData'),
	// Error info
	errorMessage: text('errorMessage'),
	// Processing timestamps
	processedAt: text('processedAt'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const bookdropSettings = sqliteTable('bookdrop_settings', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').references(() => users.id), // Per-user settings (null = global default)
	folderPath: text('folderPath'),
	enabled: integer('enabled', { mode: 'boolean' }).default(true),
	autoImport: integer('autoImport', { mode: 'boolean' }).default(false), // Preview mode by default
	// After import action: keep, move, delete
	afterImport: text('afterImport').default('move'), // keep, move, delete
	processedFolder: text('processedFolder'), // Where to move after import
	// After skip action: keep, move, delete
	afterSkip: text('afterSkip').default('keep'),
	skippedFolder: text('skippedFolder'),
	// Defaults for imported books
	defaultStatusId: integer('defaultStatusId').references(() => statuses.id),
	defaultFormatId: integer('defaultFormatId').references(() => formats.id),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// Junction Tables (Many-to-Many)
// ============================================

export const bookAuthors = sqliteTable('bookauthors', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	authorId: integer('authorId').notNull().references(() => authors.id, { onDelete: 'cascade' }),
	role: text('role').default('Author'), // Author, Co-Author, Editor, Translator, Illustrator
	isPrimary: integer('isPrimary', { mode: 'boolean' }).default(false),
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

export const bookSeries = sqliteTable('bookseries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	seriesId: integer('seriesId').notNull().references(() => series.id, { onDelete: 'cascade' }),
	bookNum: real('bookNum'), // Support decimals like 2.5
	bookNumEnd: integer('bookNumEnd'),
	isPrimary: integer('isPrimary', { mode: 'boolean' }).default(false),
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

export const bookTags = sqliteTable('booktags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

export const seriesTags = sqliteTable('seriestags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	seriesId: integer('seriesId').notNull().references(() => series.id, { onDelete: 'cascade' }),
	tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

export const authorTags = sqliteTable('authortags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	authorId: integer('authorId').notNull().references(() => authors.id, { onDelete: 'cascade' }),
	tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

export const narratorTags = sqliteTable('narratortags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	narratorId: integer('narratorId').notNull().references(() => narrators.id, { onDelete: 'cascade' }),
	tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
	createdAt: text('createdAt').notNull(),
	updatedAt: text('updatedAt').notNull()
});

// ============================================
// Library Sharing (Per-User Libraries)
// ============================================

// Library sharing between users
export const libraryShares = sqliteTable('library_shares', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	ownerId: integer('ownerId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	sharedWithId: integer('sharedWithId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	permission: text('permission').notNull().default('read'), // 'read' | 'read_write' | 'full'
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// User-Specific Book Data (Public Library Feature)
// ============================================

// User's personal reading data for a book
export const userBooks = sqliteTable('user_books', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	// Reading status (user-specific)
	statusId: integer('statusId').references(() => statuses.id),
	rating: real('rating'),
	// Reading dates
	startReadingDate: text('startReadingDate'),
	completedDate: text('completedDate'),
	// Personal notes
	comments: text('comments'),
	// Reading progress
	readingProgress: real('readingProgress').default(0),
	readingPosition: text('readingPosition'),
	lastReadAt: text('lastReadAt'),
	// DNF tracking
	dnfPage: integer('dnfPage'),
	dnfPercent: integer('dnfPercent'),
	dnfReason: text('dnfReason'),
	dnfDate: text('dnfDate'),
	// When user added book to their library
	addedAt: text('addedAt').default('CURRENT_TIMESTAMP'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// User's personal tags on a book
export const userBookTags = sqliteTable('user_book_tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP')
});

// Metadata edit suggestions queue
export const metadataSuggestions = sqliteTable('metadata_suggestions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	field: text('field').notNull(), // Which field to change
	oldValue: text('oldValue'),
	newValue: text('newValue'),
	status: text('status').default('pending'), // pending, approved, rejected
	reviewedBy: integer('reviewedBy').references(() => users.id),
	reviewedAt: text('reviewedAt'),
	reviewNotes: text('reviewNotes'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// User preferences (personal settings per user)
export const userPreferences = sqliteTable('user_preferences', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
	// Display preferences
	theme: text('theme').default('system'), // light, dark, system
	accentColor: text('accentColor').default('#3b82f6'),
	// Dashboard preferences (JSON)
	dashboardWidgets: text('dashboardWidgets'), // JSON array of widget config (legacy)
	dashboardConfig: text('dashboardConfig'), // JSON - full dashboard configuration with sections
	// Default view preferences
	defaultBooksView: text('defaultBooksView').default('grid'), // grid, list, table
	defaultBooksSort: text('defaultBooksSort').default('title'),
	defaultBooksSortOrder: text('defaultBooksSortOrder').default('asc'),
	booksPerPage: integer('booksPerPage').default(24),
	// Reader preferences
	readerFontFamily: text('readerFontFamily').default('system'),
	readerFontSize: integer('readerFontSize').default(16),
	readerLineHeight: real('readerLineHeight').default(1.6),
	readerTheme: text('readerTheme').default('auto'), // auto, light, dark, sepia
	// Notification preferences
	emailNotifications: integer('emailNotifications', { mode: 'boolean' }).default(false),
	goalReminders: integer('goalReminders', { mode: 'boolean' }).default(true),
	// ntfy notification preferences
	ntfyTopic: text('ntfyTopic'), // User's personal ntfy topic
	ntfyEnabled: integer('ntfyEnabled', { mode: 'boolean' }).default(false), // Master toggle
	notifyBookAdded: integer('notifyBookAdded', { mode: 'boolean' }).default(true),
	notifyBookCompleted: integer('notifyBookCompleted', { mode: 'boolean' }).default(true),
	notifyGoalReached: integer('notifyGoalReached', { mode: 'boolean' }).default(true),
	notifySeriesCompleted: integer('notifySeriesCompleted', { mode: 'boolean' }).default(true),
	// Sidebar state
	sidebarCollapsed: integer('sidebarCollapsed', { mode: 'boolean' }).default(false),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// Reading sessions for heatmap tracking
export const readingSessions = sqliteTable('reading_sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	userId: integer('userId').references(() => users.id, { onDelete: 'cascade' }),
	startedAt: text('startedAt').notNull(), // ISO timestamp when reading started
	endedAt: text('endedAt'), // ISO timestamp when reading ended (null if still active)
	durationMinutes: integer('durationMinutes'), // Calculated duration in minutes
	pagesRead: integer('pagesRead'), // Optional: pages read during session
	startProgress: real('startProgress'), // Progress % when session started
	endProgress: real('endProgress'), // Progress % when session ended
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// OIDC Authentication Tables
// ============================================

export const oidcProviders = sqliteTable('oidc_providers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(), // Display name, e.g., "Google", "Authentik"
	slug: text('slug').notNull().unique(), // URL-safe identifier, e.g., "google"
	issuerUrl: text('issuerUrl').notNull(), // OIDC issuer URL
	clientId: text('clientId').notNull(),
	clientSecret: text('clientSecret').notNull(), // Should be encrypted
	scopes: text('scopes').default('["openid", "profile", "email"]'), // JSON array
	enabled: integer('enabled', { mode: 'boolean' }).default(true),
	autoCreateUsers: integer('autoCreateUsers', { mode: 'boolean' }).default(false),
	defaultRole: text('defaultRole').default('member'),
	iconUrl: text('iconUrl'), // Optional icon for login button
	buttonColor: text('buttonColor'), // Optional button color
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const userOidcLinks = sqliteTable('user_oidc_links', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	providerId: integer('providerId').notNull().references(() => oidcProviders.id, { onDelete: 'cascade' }),
	oidcSubject: text('oidcSubject').notNull(), // 'sub' claim from provider
	oidcEmail: text('oidcEmail'), // Email from ID token
	oidcName: text('oidcName'), // Name from ID token
	linkedAt: text('linkedAt').default('CURRENT_TIMESTAMP'),
	lastLoginAt: text('lastLoginAt'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// Audiobook Tables
// ============================================

export const audiobooks = sqliteTable('audiobooks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	// Optional link to existing book record
	bookId: integer('bookId').references(() => books.id, { onDelete: 'set null' }),
	// Owner/uploader of the audiobook
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	// Library type: 'personal' = only visible to owner, 'public' = visible in public library
	libraryType: text('libraryType').default('personal'),
	// Metadata
	author: text('author'),
	narratorId: integer('narratorId').references(() => narrators.id),
	narratorName: text('narratorName'), // Fallback if not linked to narrator
	description: text('description'),
	coverPath: text('coverPath'),
	// Duration in seconds (calculated from all files)
	duration: real('duration').default(0),
	// Series info (if not linked to book)
	seriesName: text('seriesName'),
	seriesNumber: real('seriesNumber'),
	// External IDs
	asin: text('asin'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// User's personal library entry for an audiobook (for "add to library" functionality)
export const userAudiobooks = sqliteTable('user_audiobooks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	audiobookId: integer('audiobookId').notNull().references(() => audiobooks.id, { onDelete: 'cascade' }),
	// Listening status (user-specific)
	statusId: integer('statusId').references(() => statuses.id),
	rating: real('rating'),
	// Personal notes
	comments: text('comments'),
	// When user added audiobook to their library
	addedAt: text('addedAt').default('CURRENT_TIMESTAMP'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const audiobookFiles = sqliteTable('audiobook_files', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	audiobookId: integer('audiobookId').notNull().references(() => audiobooks.id, { onDelete: 'cascade' }),
	// File info
	filename: text('filename').notNull(),
	filePath: text('filePath').notNull(),
	fileSize: integer('fileSize'), // bytes
	mimeType: text('mimeType').default('audio/mpeg'),
	// Track info
	trackNumber: integer('trackNumber').notNull().default(1),
	title: text('title'), // Chapter/track name
	duration: real('duration').notNull().default(0), // seconds
	// Cumulative offset for seeking (sum of previous tracks' durations)
	startOffset: real('startOffset').default(0),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const audiobookProgress = sqliteTable('audiobook_progress', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	audiobookId: integer('audiobookId').notNull().references(() => audiobooks.id, { onDelete: 'cascade' }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	// Current position
	currentTime: real('currentTime').default(0), // seconds from start of audiobook
	currentFileId: integer('currentFileId').references(() => audiobookFiles.id),
	// Progress tracking
	duration: real('duration').default(0), // total duration
	progress: real('progress').default(0), // 0-1
	// Playback settings (persisted per user per audiobook)
	playbackRate: real('playbackRate').default(1),
	// Completion status
	isFinished: integer('isFinished', { mode: 'boolean' }).default(false),
	finishedAt: text('finishedAt'),
	// Activity tracking
	lastPlayedAt: text('lastPlayedAt'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const audiobookChapters = sqliteTable('audiobook_chapters', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	audiobookId: integer('audiobookId').notNull().references(() => audiobooks.id, { onDelete: 'cascade' }),
	// Chapter info
	title: text('title').notNull(),
	startTime: real('startTime').notNull().default(0), // seconds from start
	endTime: real('endTime'), // seconds, null = until next chapter or end
	chapterNumber: integer('chapterNumber').notNull().default(1),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

export const audiobookBookmarks = sqliteTable('audiobook_bookmarks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	audiobookId: integer('audiobookId').notNull().references(() => audiobooks.id, { onDelete: 'cascade' }),
	userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
	// Bookmark position
	time: real('time').notNull(), // seconds from start
	// Optional note
	title: text('title'),
	note: text('note'),
	// Timestamps
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// Ignored Duplicates (pairs marked as not duplicates)
// ============================================

export const ignoredDuplicates = sqliteTable('ignored_duplicates', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	entityType: text('entityType').notNull(), // 'author', 'series', 'book'
	entityId1: integer('entityId1').notNull(), // First entity ID (always the smaller ID)
	entityId2: integer('entityId2').notNull(), // Second entity ID (always the larger ID)
	createdAt: text('createdAt').notNull(),
	createdBy: integer('createdBy').references(() => users.id, { onDelete: 'set null' })
});

// ============================================
// Media Sources (where books were purchased)
// ============================================

export const mediaSources = sqliteTable('media_sources', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(), // "Audible", "Kindle", "Physical", "Kobo", etc.
	icon: text('icon').default('shopping-bag'), // Lucide icon name
	color: text('color').default('#6c757d'),
	url: text('url'), // Base URL for the service (e.g., https://audible.com)
	isSystem: integer('isSystem', { mode: 'boolean' }).default(false), // System-defined sources
	userId: integer('userId').references(() => users.id, { onDelete: 'cascade' }), // null = system-wide, value = private to user
	displayOrder: integer('displayOrder').default(0),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// Junction table linking books to their media sources
export const bookMediaSources = sqliteTable('book_media_sources', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
	mediaSourceId: integer('mediaSourceId').notNull().references(() => mediaSources.id, { onDelete: 'cascade' }),
	// Optional metadata about the purchase
	purchaseDate: text('purchaseDate'),
	purchasePrice: real('purchasePrice'),
	externalUrl: text('externalUrl'), // Direct link to the book on this service
	externalId: text('externalId'), // ID on the external service (e.g., ASIN)
	notes: text('notes'),
	createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
	updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP')
});

// ============================================
// Relations
// ============================================

export const booksRelations = relations(books, ({ one, many }) => ({
	status: one(statuses, { fields: [books.statusId], references: [statuses.id] }),
	genre: one(genres, { fields: [books.genreId], references: [genres.id] }),
	format: one(formats, { fields: [books.formatId], references: [formats.id] }),
	narrator: one(narrators, { fields: [books.narratorId], references: [narrators.id] }),
	owner: one(users, { fields: [books.ownerId], references: [users.id] }),
	bookAuthors: many(bookAuthors),
	bookSeries: many(bookSeries),
	bookTags: many(bookTags),
	bookMediaSources: many(bookMediaSources),
	userBooks: many(userBooks),
	userBookTags: many(userBookTags),
	metadataSuggestions: many(metadataSuggestions),
	readingSessions: many(readingSessions)
}));

export const authorsRelations = relations(authors, ({ many }) => ({
	bookAuthors: many(bookAuthors),
	authorTags: many(authorTags)
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
	status: one(seriesStatuses, { fields: [series.statusId], references: [seriesStatuses.id] }),
	genre: one(genres, { fields: [series.genreId], references: [genres.id] }),
	bookSeries: many(bookSeries),
	seriesTags: many(seriesTags)
}));

export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
	book: one(books, { fields: [bookAuthors.bookId], references: [books.id] }),
	author: one(authors, { fields: [bookAuthors.authorId], references: [authors.id] })
}));

export const bookSeriesRelations = relations(bookSeries, ({ one }) => ({
	book: one(books, { fields: [bookSeries.bookId], references: [books.id] }),
	series: one(series, { fields: [bookSeries.seriesId], references: [series.id] })
}));

export const bookTagsRelations = relations(bookTags, ({ one }) => ({
	book: one(books, { fields: [bookTags.bookId], references: [books.id] }),
	tag: one(tags, { fields: [bookTags.tagId], references: [tags.id] })
}));

export const seriesTagsRelations = relations(seriesTags, ({ one }) => ({
	series: one(series, { fields: [seriesTags.seriesId], references: [series.id] }),
	tag: one(tags, { fields: [seriesTags.tagId], references: [tags.id] })
}));

export const authorTagsRelations = relations(authorTags, ({ one }) => ({
	author: one(authors, { fields: [authorTags.authorId], references: [authors.id] }),
	tag: one(tags, { fields: [authorTags.tagId], references: [tags.id] })
}));

export const narratorTagsRelations = relations(narratorTags, ({ one }) => ({
	narrator: one(narrators, { fields: [narratorTags.narratorId], references: [narrators.id] }),
	tag: one(tags, { fields: [narratorTags.tagId], references: [tags.id] })
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	bookTags: many(bookTags),
	seriesTags: many(seriesTags),
	authorTags: many(authorTags),
	narratorTags: many(narratorTags),
	userBookTags: many(userBookTags)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
	userBooks: many(userBooks),
	userBookTags: many(userBookTags),
	metadataSuggestions: many(metadataSuggestions),
	readingSessions: many(readingSessions),
	preferences: one(userPreferences, { fields: [users.id], references: [userPreferences.userId] }),
	oidcLinks: many(userOidcLinks),
	ownedBooks: many(books),
	sharedLibraries: many(libraryShares, { relationName: 'sharedWith' }),
	libraryShares: many(libraryShares, { relationName: 'owner' })
}));

export const librarySharesRelations = relations(libraryShares, ({ one }) => ({
	owner: one(users, { fields: [libraryShares.ownerId], references: [users.id], relationName: 'owner' }),
	sharedWith: one(users, { fields: [libraryShares.sharedWithId], references: [users.id], relationName: 'sharedWith' })
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(users, { fields: [userPreferences.userId], references: [users.id] })
}));

export const readingSessionsRelations = relations(readingSessions, ({ one }) => ({
	book: one(books, { fields: [readingSessions.bookId], references: [books.id] }),
	user: one(users, { fields: [readingSessions.userId], references: [users.id] })
}));

export const userBooksRelations = relations(userBooks, ({ one }) => ({
	user: one(users, { fields: [userBooks.userId], references: [users.id] }),
	book: one(books, { fields: [userBooks.bookId], references: [books.id] }),
	status: one(statuses, { fields: [userBooks.statusId], references: [statuses.id] })
}));

export const userBookTagsRelations = relations(userBookTags, ({ one }) => ({
	user: one(users, { fields: [userBookTags.userId], references: [users.id] }),
	book: one(books, { fields: [userBookTags.bookId], references: [books.id] }),
	tag: one(tags, { fields: [userBookTags.tagId], references: [tags.id] })
}));

export const metadataSuggestionsRelations = relations(metadataSuggestions, ({ one }) => ({
	book: one(books, { fields: [metadataSuggestions.bookId], references: [books.id] }),
	user: one(users, { fields: [metadataSuggestions.userId], references: [users.id] }),
	reviewer: one(users, { fields: [metadataSuggestions.reviewedBy], references: [users.id] })
}));

export const oidcProvidersRelations = relations(oidcProviders, ({ many }) => ({
	userLinks: many(userOidcLinks)
}));

export const userOidcLinksRelations = relations(userOidcLinks, ({ one }) => ({
	user: one(users, { fields: [userOidcLinks.userId], references: [users.id] }),
	provider: one(oidcProviders, { fields: [userOidcLinks.providerId], references: [oidcProviders.id] })
}));

// Audiobook relations
export const audiobooksRelations = relations(audiobooks, ({ one, many }) => ({
	book: one(books, { fields: [audiobooks.bookId], references: [books.id] }),
	user: one(users, { fields: [audiobooks.userId], references: [users.id] }),
	narrator: one(narrators, { fields: [audiobooks.narratorId], references: [narrators.id] }),
	files: many(audiobookFiles),
	chapters: many(audiobookChapters),
	progress: many(audiobookProgress),
	bookmarks: many(audiobookBookmarks),
	userLibraryEntries: many(userAudiobooks)
}));

export const userAudiobooksRelations = relations(userAudiobooks, ({ one }) => ({
	user: one(users, { fields: [userAudiobooks.userId], references: [users.id] }),
	audiobook: one(audiobooks, { fields: [userAudiobooks.audiobookId], references: [audiobooks.id] }),
	status: one(statuses, { fields: [userAudiobooks.statusId], references: [statuses.id] })
}));

export const audiobookFilesRelations = relations(audiobookFiles, ({ one }) => ({
	audiobook: one(audiobooks, { fields: [audiobookFiles.audiobookId], references: [audiobooks.id] })
}));

export const audiobookProgressRelations = relations(audiobookProgress, ({ one }) => ({
	audiobook: one(audiobooks, { fields: [audiobookProgress.audiobookId], references: [audiobooks.id] }),
	user: one(users, { fields: [audiobookProgress.userId], references: [users.id] }),
	currentFile: one(audiobookFiles, { fields: [audiobookProgress.currentFileId], references: [audiobookFiles.id] })
}));

export const audiobookChaptersRelations = relations(audiobookChapters, ({ one }) => ({
	audiobook: one(audiobooks, { fields: [audiobookChapters.audiobookId], references: [audiobooks.id] })
}));

export const audiobookBookmarksRelations = relations(audiobookBookmarks, ({ one }) => ({
	audiobook: one(audiobooks, { fields: [audiobookBookmarks.audiobookId], references: [audiobooks.id] }),
	user: one(users, { fields: [audiobookBookmarks.userId], references: [users.id] })
}));

// Media Sources relations
export const mediaSourcesRelations = relations(mediaSources, ({ many }) => ({
	bookMediaSources: many(bookMediaSources)
}));

export const bookMediaSourcesRelations = relations(bookMediaSources, ({ one }) => ({
	book: one(books, { fields: [bookMediaSources.bookId], references: [books.id] }),
	mediaSource: one(mediaSources, { fields: [bookMediaSources.mediaSourceId], references: [mediaSources.id] })
}));

// ============================================
// Type exports
// ============================================

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Series = typeof series.$inferSelect;
export type NewSeries = typeof series.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type Status = typeof statuses.$inferSelect;
export type Format = typeof formats.$inferSelect;
export type NewFormat = typeof formats.$inferInsert;
export type Narrator = typeof narrators.$inferSelect;
export type NewNarrator = typeof narrators.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type User = typeof users.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type MagicShelf = typeof magicShelves.$inferSelect;
export type NewMagicShelf = typeof magicShelves.$inferInsert;
export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
export type BookdropQueueItem = typeof bookdropQueue.$inferSelect;
export type NewBookdropQueueItem = typeof bookdropQueue.$inferInsert;
export type BookdropSettings = typeof bookdropSettings.$inferSelect;
export type NewBookdropSettings = typeof bookdropSettings.$inferInsert;
export type UserBook = typeof userBooks.$inferSelect;
export type NewUserBook = typeof userBooks.$inferInsert;
export type UserBookTag = typeof userBookTags.$inferSelect;
export type NewUserBookTag = typeof userBookTags.$inferInsert;
export type MetadataSuggestion = typeof metadataSuggestions.$inferSelect;
export type NewMetadataSuggestion = typeof metadataSuggestions.$inferInsert;
export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type OidcProvider = typeof oidcProviders.$inferSelect;
export type NewOidcProvider = typeof oidcProviders.$inferInsert;
export type UserOidcLink = typeof userOidcLinks.$inferSelect;
export type NewUserOidcLink = typeof userOidcLinks.$inferInsert;
export type LibraryShare = typeof libraryShares.$inferSelect;
export type NewLibraryShare = typeof libraryShares.$inferInsert;
export type AuthorTag = typeof authorTags.$inferSelect;
export type NewAuthorTag = typeof authorTags.$inferInsert;

// Audiobook types
export type Audiobook = typeof audiobooks.$inferSelect;
export type NewAudiobook = typeof audiobooks.$inferInsert;
export type AudiobookFile = typeof audiobookFiles.$inferSelect;
export type NewAudiobookFile = typeof audiobookFiles.$inferInsert;
export type AudiobookProgress = typeof audiobookProgress.$inferSelect;
export type NewAudiobookProgress = typeof audiobookProgress.$inferInsert;
export type AudiobookChapter = typeof audiobookChapters.$inferSelect;
export type NewAudiobookChapter = typeof audiobookChapters.$inferInsert;
export type AudiobookBookmark = typeof audiobookBookmarks.$inferSelect;
export type NewAudiobookBookmark = typeof audiobookBookmarks.$inferInsert;
export type UserAudiobook = typeof userAudiobooks.$inferSelect;
export type NewUserAudiobook = typeof userAudiobooks.$inferInsert;

// Media source types
export type MediaSource = typeof mediaSources.$inferSelect;
export type NewMediaSource = typeof mediaSources.$inferInsert;
export type BookMediaSource = typeof bookMediaSources.$inferSelect;
export type NewBookMediaSource = typeof bookMediaSources.$inferInsert;

// Library type values
export type LibraryType = 'personal' | 'public';

// Library share permission levels
export type LibrarySharePermission = 'read' | 'read_write' | 'full';

// User roles
export type UserRole = 'admin' | 'librarian' | 'member' | 'viewer' | 'guest';
