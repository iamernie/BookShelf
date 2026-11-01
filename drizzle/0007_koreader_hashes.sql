CREATE TABLE `book_ebook_hashes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`hash` text NOT NULL,
	`source` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_ebook_hashes_book_hash` ON `book_ebook_hashes` (`bookId`,`hash`);--> statement-breakpoint
CREATE INDEX `idx_book_ebook_hashes_hash` ON `book_ebook_hashes` (`hash`);