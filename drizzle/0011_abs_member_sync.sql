CREATE TABLE `abs_member_item_state` (
	`userId` integer NOT NULL,
	`absItemId` text NOT NULL,
	`lastActedUpdate` integer NOT NULL,
	`lastActedFinished` integer DEFAULT 0 NOT NULL,
	`bookId` integer,
	`updatedAt` text NOT NULL,
	PRIMARY KEY(`userId`, `absItemId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `abs_sync_member_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`runId` integer NOT NULL,
	`userId` integer NOT NULL,
	`status` text NOT NULL,
	`progressSeen` integer DEFAULT 0 NOT NULL,
	`statusFlips` integer DEFAULT 0 NOT NULL,
	`autoAdded` integer DEFAULT 0 NOT NULL,
	`notReachable` integer DEFAULT 0 NOT NULL,
	`unlinked` integer DEFAULT 0 NOT NULL,
	`error` text,
	`details` text,
	FOREIGN KEY (`runId`) REFERENCES `abs_sync_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "abs_sync_member_runs_status" CHECK("abs_sync_member_runs"."status" IN ('succeeded','partial','failed','skipped'))
);
--> statement-breakpoint
CREATE INDEX `abs_sync_member_runs_run` ON `abs_sync_member_runs` (`runId`);--> statement-breakpoint
CREATE INDEX `abs_sync_member_runs_user` ON `abs_sync_member_runs` (`userId`);--> statement-breakpoint
CREATE TABLE `abs_user_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`absUserId` text,
	`absUsername` text,
	`keySource` text NOT NULL,
	`keyCiphertext` text,
	`keyFingerprint` text,
	`syncListening` integer DEFAULT 0 NOT NULL,
	`baselineAt` integer,
	`connectedBy` integer,
	`connectedAt` text NOT NULL,
	`lastSyncAt` text,
	`lastError` text,
	`lastErrorAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connectedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "abs_user_connections_key_source" CHECK("abs_user_connections"."keySource" IN ('own','site')),
	CONSTRAINT "abs_user_connections_ciphertext" CHECK(("abs_user_connections"."keySource" = 'site') = ("abs_user_connections"."keyCiphertext" IS NULL)),
	CONSTRAINT "abs_user_connections_abs_user_set" CHECK("abs_user_connections"."keySource" = 'site' OR "abs_user_connections"."absUserId" IS NOT NULL),
	CONSTRAINT "abs_user_connections_sync_listening" CHECK("abs_user_connections"."syncListening" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abs_user_connections_userId_unique` ON `abs_user_connections` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `abs_user_connections_abs_user` ON `abs_user_connections` (`absUserId`);--> statement-breakpoint
CREATE UNIQUE INDEX `abs_user_connections_single_site` ON `abs_user_connections` (`keySource`) WHERE "abs_user_connections"."keySource" = 'site';--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `notifyAbsConnection` integer DEFAULT true;