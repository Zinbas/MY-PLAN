CREATE TABLE `personalReminderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceKind` enum('task','event','block') NOT NULL,
	`sourceId` varchar(255) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`body` varchar(512) NOT NULL,
	`targetSection` enum('calendar','todo') NOT NULL,
	`occursAt` timestamp NOT NULL,
	`deliveryKey` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personalReminderItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `personalReminderItems_user_source_unique` UNIQUE(`userId`,`sourceKind`,`sourceId`)
);
--> statement-breakpoint
ALTER TABLE `personalReminderItems` ADD CONSTRAINT `personalReminderItems_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `personalReminderItems_user_active_idx` ON `personalReminderItems` (`userId`,`isActive`,`occursAt`);