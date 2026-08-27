CREATE TABLE `plannerSnapshots` (
	`userId` int NOT NULL,
	`payload` mediumtext NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plannerSnapshots_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `plannerSnapshots` ADD CONSTRAINT `plannerSnapshots_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;