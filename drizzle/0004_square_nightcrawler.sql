CREATE TABLE `sparkAccessTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `sparkAccessTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `sparkAccessTokens_tokenHash_unique` UNIQUE(`tokenHash`),
	CONSTRAINT `sparkAccessTokens_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `sparkEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(1024) NOT NULL,
	`description` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sparkEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sparkAccessTokens` ADD CONSTRAINT `sparkAccessTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sparkEvents` ADD CONSTRAINT `sparkEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sparkEvents_user_start_idx` ON `sparkEvents` (`userId`,`startAt`);