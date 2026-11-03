CREATE TABLE `audible_refresh_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`triggerType` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`triggeredBy` integer,
	`scopeSeriesId` integer,
	`startedAt` text NOT NULL,
	`finishedAt` text,
	`durationMs` integer,
	`seriesChecked` integer DEFAULT 0 NOT NULL,
	`seriesMatched` integer DEFAULT 0 NOT NULL,
	`seriesNoMatch` integer DEFAULT 0 NOT NULL,
	`seriesFailed` integer DEFAULT 0 NOT NULL,
	`productsCached` integer DEFAULT 0 NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`details` text,
	`error` text,
	FOREIGN KEY (`triggeredBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audible_refresh_runs_single_running` ON `audible_refresh_runs` (`status`) WHERE "audible_refresh_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX `audible_refresh_runs_started` ON `audible_refresh_runs` (`startedAt`);--> statement-breakpoint
CREATE TABLE `audible_series_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seriesId` integer NOT NULL,
	`asin` text NOT NULL,
	`sequence` real,
	`sequenceRaw` text,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text NOT NULL,
	`narrators` text NOT NULL,
	`runtimeMin` integer,
	`coverUrl` text,
	`releaseDate` text,
	`fetchedAt` text NOT NULL,
	FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_audible_series_books_series_asin` ON `audible_series_books` (`seriesId`,`asin`);--> statement-breakpoint
CREATE INDEX `idx_audible_series_books_asin` ON `audible_series_books` (`asin`);--> statement-breakpoint
ALTER TABLE `series` ADD `audibleAsin` text;--> statement-breakpoint
ALTER TABLE `series` ADD `audibleSeriesTitle` text;--> statement-breakpoint
ALTER TABLE `series` ADD `audibleStatus` text;--> statement-breakpoint
ALTER TABLE `series` ADD `audibleCheckedAt` text;--> statement-breakpoint
ALTER TABLE `series` ADD `audibleRefreshedAt` text;--> statement-breakpoint
ALTER TABLE `series` ADD `audibleRefreshError` text;