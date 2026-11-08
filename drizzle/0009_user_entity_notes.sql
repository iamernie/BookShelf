CREATE TABLE `user_author_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`authorId` integer NOT NULL,
	`notes` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_author_notes_user_author` ON `user_author_notes` (`userId`,`authorId`);--> statement-breakpoint
CREATE INDEX `idx_user_author_notes_author` ON `user_author_notes` (`authorId`);--> statement-breakpoint
CREATE TABLE `user_narrator_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`narratorId` integer NOT NULL,
	`notes` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narratorId`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_narrator_notes_user_narrator` ON `user_narrator_notes` (`userId`,`narratorId`);--> statement-breakpoint
CREATE INDEX `idx_user_narrator_notes_narrator` ON `user_narrator_notes` (`narratorId`);--> statement-breakpoint
CREATE TABLE `user_series_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`seriesId` integer NOT NULL,
	`notes` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_series_notes_user_series` ON `user_series_notes` (`userId`,`seriesId`);--> statement-breakpoint
CREATE INDEX `idx_user_series_notes_series` ON `user_series_notes` (`seriesId`);