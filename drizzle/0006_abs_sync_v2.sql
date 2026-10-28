CREATE TABLE `abs_sync_attention` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`absItemId` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`itemTitle` text,
	`itemAuthor` text,
	`itemNarrator` text,
	`itemAsin` text,
	`itemIsbn` text,
	`tier` text,
	`candidates` text NOT NULL,
	`resolution` text,
	`resolvedBookId` integer,
	`resolvedBy` integer,
	`firstSeenRunId` integer,
	`lastSeenRunId` integer,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`resolvedAt` text,
	FOREIGN KEY (`resolvedBookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`firstSeenRunId`) REFERENCES `abs_sync_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lastSeenRunId`) REFERENCES `abs_sync_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `abs_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`triggerType` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`triggeredBy` integer,
	`startedAt` text NOT NULL,
	`finishedAt` text,
	`durationMs` integer,
	`libraryId` text,
	`itemsScanned` integer DEFAULT 0 NOT NULL,
	`scanComplete` integer DEFAULT false NOT NULL,
	`linked` integer DEFAULT 0 NOT NULL,
	`created` integer DEFAULT 0 NOT NULL,
	`pushed` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`queued` integer DEFAULT 0 NOT NULL,
	`staleFound` integer DEFAULT 0 NOT NULL,
	`staleCleared` integer DEFAULT 0 NOT NULL,
	`statusFlips` integer DEFAULT 0 NOT NULL,
	`details` text,
	`error` text,
	`alertedAt` text,
	FOREIGN KEY (`triggeredBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `books` ADD `absLinkStaleAt` text;--> statement-breakpoint
CREATE UNIQUE INDEX `abs_sync_runs_single_running` ON `abs_sync_runs` (`status`) WHERE "abs_sync_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX `abs_sync_runs_started` ON `abs_sync_runs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `abs_sync_runs_trigger_mode_started` ON `abs_sync_runs` (`triggerType`,`mode`,`startedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `abs_sync_attention_open_item` ON `abs_sync_attention` (`absItemId`) WHERE "abs_sync_attention"."status" = 'open';--> statement-breakpoint
CREATE INDEX `abs_sync_attention_item` ON `abs_sync_attention` (`absItemId`,`status`);--> statement-breakpoint
-- Startup code creates this only once no item is linked to two books (it retries on every sync run)
CREATE UNIQUE INDEX `books_absItemId_unique` ON `books` (`absItemId`) WHERE "books"."absItemId" IS NOT NULL;
