ALTER TABLE `oidc_providers` ADD `groupsClaim` text DEFAULT 'groups';--> statement-breakpoint
ALTER TABLE `oidc_providers` ADD `requiredGroup` text DEFAULT '';