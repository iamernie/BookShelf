CREATE TABLE `widget_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text,
	`type` text NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`itemLimit` integer DEFAULT 5 NOT NULL,
	`keyHash` text NOT NULL,
	`keyPrefix` text NOT NULL,
	`lastFetchedAt` text,
	`rotatedAt` text,
	`disabledAt` text,
	`disabledBy` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`disabledBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `widget_instances_keyHash_unique` ON `widget_instances` (`keyHash`);