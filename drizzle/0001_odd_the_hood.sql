CREATE TABLE `googleOAuthStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `googleOAuthStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleOAuthStates_stateHash_unique` UNIQUE(`stateHash`)
);
--> statement-breakpoint
ALTER TABLE `googleOAuthStates` ADD CONSTRAINT `googleOAuthStates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `googleOAuthStates_user_idx` ON `googleOAuthStates` (`userId`);