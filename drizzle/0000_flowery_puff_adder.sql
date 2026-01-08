CREATE TABLE `audiobook_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audiobookId` integer NOT NULL,
	`userId` integer NOT NULL,
	`time` real NOT NULL,
	`title` text,
	`note` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`audiobookId`) REFERENCES `audiobooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audiobook_chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audiobookId` integer NOT NULL,
	`title` text NOT NULL,
	`startTime` real DEFAULT 0 NOT NULL,
	`endTime` real,
	`chapterNumber` integer DEFAULT 1 NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`audiobookId`) REFERENCES `audiobooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audiobook_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audiobookId` integer NOT NULL,
	`filename` text NOT NULL,
	`filePath` text NOT NULL,
	`fileSize` integer,
	`mimeType` text DEFAULT 'audio/mpeg',
	`trackNumber` integer DEFAULT 1 NOT NULL,
	`title` text,
	`duration` real DEFAULT 0 NOT NULL,
	`startOffset` real DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`audiobookId`) REFERENCES `audiobooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audiobook_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audiobookId` integer NOT NULL,
	`userId` integer NOT NULL,
	`currentTime` real DEFAULT 0,
	`currentFileId` integer,
	`duration` real DEFAULT 0,
	`progress` real DEFAULT 0,
	`playbackRate` real DEFAULT 1,
	`isFinished` integer DEFAULT false,
	`finishedAt` text,
	`lastPlayedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`audiobookId`) REFERENCES `audiobooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currentFileId`) REFERENCES `audiobook_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audiobooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`bookId` integer,
	`userId` integer NOT NULL,
	`libraryType` text DEFAULT 'personal',
	`author` text,
	`narratorId` integer,
	`narratorName` text,
	`description` text,
	`coverPath` text,
	`duration` real DEFAULT 0,
	`seriesName` text,
	`seriesNumber` real,
	`asin` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narratorId`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `authortags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authorId` integer NOT NULL,
	`tagId` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`birthDate` text,
	`deathDate` text,
	`birthPlace` text,
	`photoUrl` text,
	`website` text,
	`wikipediaUrl` text,
	`comments` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `bookauthors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`authorId` integer NOT NULL,
	`role` text DEFAULT 'Author',
	`isPrimary` integer DEFAULT false,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_media_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`mediaSourceId` integer NOT NULL,
	`purchaseDate` text,
	`purchasePrice` real,
	`externalUrl` text,
	`externalId` text,
	`notes` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mediaSourceId`) REFERENCES `media_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bookseries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`seriesId` integer NOT NULL,
	`bookNum` real,
	`bookNumEnd` integer,
	`isPrimary` integer DEFAULT false,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `booktags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`tagId` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bookdrop_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`filename` text NOT NULL,
	`filePath` text NOT NULL,
	`fileSize` integer,
	`fileHash` text,
	`source` text DEFAULT 'upload',
	`status` text DEFAULT 'pending',
	`bookId` integer,
	`metadata` text,
	`coverData` text,
	`errorMessage` text,
	`processedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookdrop_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`folderPath` text,
	`enabled` integer DEFAULT true,
	`autoImport` integer DEFAULT false,
	`afterImport` text DEFAULT 'move',
	`processedFolder` text,
	`afterSkip` text DEFAULT 'keep',
	`skippedFolder` text,
	`defaultStatusId` integer,
	`defaultFormatId` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defaultStatusId`) REFERENCES `statuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defaultFormatId`) REFERENCES `formats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`rating` real,
	`coverImageUrl` text,
	`originalCoverUrl` text,
	`bookNum` integer,
	`bookNumEnd` integer,
	`summary` text,
	`comments` text,
	`releaseDate` text,
	`startReadingDate` text,
	`completedDate` text,
	`isbn10` text,
	`isbn13` text,
	`asin` text,
	`goodreadsId` text,
	`googleBooksId` text,
	`providerRating` real,
	`providerRatingSource` text,
	`providerRatingCount` integer,
	`pageCount` integer,
	`publisher` text,
	`publishYear` integer,
	`language` text DEFAULT 'English',
	`edition` text,
	`purchasePrice` real,
	`dnfPage` integer,
	`dnfPercent` integer,
	`dnfReason` text,
	`dnfDate` text,
	`ebookPath` text,
	`ebookFormat` text,
	`ebookMd5` text,
	`readingProgress` text,
	`lastReadAt` text,
	`libraryType` text DEFAULT 'personal',
	`ownerId` integer,
	`statusId` integer,
	`genreId` integer,
	`formatId` integer,
	`narratorId` integer,
	`authorId` integer,
	`seriesId` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`statusId`) REFERENCES `statuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genreId`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`formatId`) REFERENCES `formats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`narratorId`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `formats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'book',
	`color` text DEFAULT '#6c757d',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`slug` text,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_slug_unique` ON `genres` (`slug`);--> statement-breakpoint
CREATE TABLE `ignored_duplicates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entityType` text NOT NULL,
	`entityId1` integer NOT NULL,
	`entityId2` integer NOT NULL,
	`createdAt` text NOT NULL,
	`createdBy` integer,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `invitecodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`label` text,
	`maxUses` integer,
	`usedCount` integer DEFAULT 0,
	`expiresAt` text,
	`isActive` integer DEFAULT true,
	`createdBy` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitecodes_code_unique` ON `invitecodes` (`code`);--> statement-breakpoint
CREATE TABLE `kobo_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`deviceId` text NOT NULL,
	`deviceModel` text,
	`accessToken` text,
	`refreshToken` text,
	`lastSyncAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kobo_reading_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`entitlementId` text NOT NULL,
	`progressPercent` real,
	`status` text,
	`locationValue` text,
	`locationType` text,
	`locationSource` text,
	`spentReadingMinutes` integer,
	`lastModified` text,
	`lastSyncedToDevice` text,
	`deviceData` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kobo_sync_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`entitlementId` text NOT NULL,
	`synced` integer DEFAULT false,
	`removed` integer DEFAULT false,
	`lastSyncedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kobo_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`token` text NOT NULL,
	`syncEnabled` integer DEFAULT true,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kobo_users_userId_unique` ON `kobo_users` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `kobo_users_token_unique` ON `kobo_users` (`token`);--> statement-breakpoint
CREATE TABLE `koreader_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer,
	`documentHash` text NOT NULL,
	`progress` text,
	`percentage` real,
	`device` text,
	`deviceId` text,
	`timestamp` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `koreader_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`passwordMd5` text NOT NULL,
	`syncEnabled` integer DEFAULT true,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `koreader_users_userId_unique` ON `koreader_users` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `koreader_users_username_unique` ON `koreader_users` (`username`);--> statement-breakpoint
CREATE TABLE `library_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ownerId` integer NOT NULL,
	`sharedWithId` integer NOT NULL,
	`permission` text DEFAULT 'read' NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sharedWithId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `magicshelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'bookmark',
	`iconColor` text DEFAULT '#6c757d',
	`filterJson` text NOT NULL,
	`sortField` text DEFAULT 'title',
	`sortOrder` text DEFAULT 'asc',
	`isPublic` integer DEFAULT false,
	`userId` integer,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'shopping-bag',
	`color` text DEFAULT '#6c757d',
	`url` text,
	`isSystem` integer DEFAULT false,
	`userId` integer,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `metadata_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`userId` integer NOT NULL,
	`field` text NOT NULL,
	`oldValue` text,
	`newValue` text,
	`status` text DEFAULT 'pending',
	`reviewedBy` integer,
	`reviewedAt` text,
	`reviewNotes` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `narratortags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`narratorId` integer NOT NULL,
	`tagId` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`narratorId`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `narrators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`birthDate` text,
	`deathDate` text,
	`birthPlace` text,
	`photoUrl` text,
	`website` text,
	`wikipediaUrl` text,
	`comments` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `oidc_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`issuerUrl` text NOT NULL,
	`clientId` text NOT NULL,
	`clientSecret` text NOT NULL,
	`scopes` text DEFAULT '["openid", "profile", "email"]',
	`enabled` integer DEFAULT true,
	`autoCreateUsers` integer DEFAULT false,
	`defaultRole` text DEFAULT 'member',
	`iconUrl` text,
	`buttonColor` text,
	`displayOrder` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oidc_providers_slug_unique` ON `oidc_providers` (`slug`);--> statement-breakpoint
CREATE TABLE `readinggoals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`targetBooks` integer DEFAULT 12,
	`booksRead` integer DEFAULT 0,
	`isActive` integer DEFAULT true,
	`challengeType` text,
	`name` text,
	`icon` text,
	`targetGenres` integer,
	`targetAuthors` integer,
	`targetFormats` integer,
	`targetPages` integer,
	`targetMonthly` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`userId` integer,
	`startedAt` text NOT NULL,
	`endedAt` text,
	`durationMinutes` integer,
	`pagesRead` integer,
	`startProgress` real,
	`endProgress` real,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`numBooks` integer,
	`comments` text,
	`statusId` integer,
	`genreId` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`statusId`) REFERENCES `seriesstatuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genreId`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seriesstatuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key` text,
	`isSystem` integer DEFAULT false,
	`color` text DEFAULT '#6c757d',
	`icon` text DEFAULT 'fas fa-bookmark',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `seriestags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seriesId` integer NOT NULL,
	`tagId` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`expires` text,
	`data` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`type` text DEFAULT 'string',
	`category` text,
	`label` text,
	`description` text,
	`isSystem` integer DEFAULT false,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key` text,
	`isSystem` integer DEFAULT false,
	`color` text DEFAULT '#6c757d',
	`icon` text DEFAULT 'fas fa-bookmark',
	`sortOrder` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statuses_key_unique` ON `statuses` (`key`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6c757d',
	`icon` text,
	`isSystem` integer DEFAULT false,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `user_audiobooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`audiobookId` integer NOT NULL,
	`statusId` integer,
	`rating` real,
	`comments` text,
	`addedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audiobookId`) REFERENCES `audiobooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statusId`) REFERENCES `statuses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_book_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`tagId` integer NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`statusId` integer,
	`rating` real,
	`startReadingDate` text,
	`completedDate` text,
	`comments` text,
	`readingProgress` real DEFAULT 0,
	`readingPosition` text,
	`lastReadAt` text,
	`dnfPage` integer,
	`dnfPercent` integer,
	`dnfReason` text,
	`dnfDate` text,
	`addedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statusId`) REFERENCES `statuses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_oidc_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`providerId` integer NOT NULL,
	`oidcSubject` text NOT NULL,
	`oidcEmail` text,
	`oidcName` text,
	`linkedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`lastLoginAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`providerId`) REFERENCES `oidc_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`theme` text DEFAULT 'system',
	`accentColor` text DEFAULT '#3b82f6',
	`dashboardWidgets` text,
	`dashboardConfig` text,
	`defaultBooksView` text DEFAULT 'grid',
	`defaultBooksSort` text DEFAULT 'title',
	`defaultBooksSortOrder` text DEFAULT 'asc',
	`booksPerPage` integer DEFAULT 24,
	`readerFontFamily` text DEFAULT 'system',
	`readerFontSize` integer DEFAULT 16,
	`readerLineHeight` real DEFAULT 1.6,
	`readerTheme` text DEFAULT 'auto',
	`emailNotifications` integer DEFAULT false,
	`goalReminders` integer DEFAULT true,
	`ntfyTopic` text,
	`ntfyEnabled` integer DEFAULT false,
	`notifyBookAdded` integer DEFAULT true,
	`notifyBookCompleted` integer DEFAULT true,
	`notifyGoalReached` integer DEFAULT true,
	`notifySeriesCompleted` integer DEFAULT true,
	`sidebarCollapsed` integer DEFAULT false,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_userId_unique` ON `user_preferences` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'member',
	`firstName` text,
	`lastName` text,
	`failedLoginAttempts` integer DEFAULT 0,
	`lockoutUntil` text,
	`resetToken` text,
	`resetTokenExpires` text,
	`emailVerified` integer DEFAULT false,
	`emailVerificationToken` text,
	`emailVerificationExpires` text,
	`approvalStatus` text DEFAULT 'approved',
	`approvedBy` integer,
	`approvedAt` text,
	`inviteCodeUsed` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);