CREATE TABLE `pushReminderDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deliveryKey` varchar(128) NOT NULL,
	`sourceKind` enum('task','event','block') NOT NULL,
	`sourceId` varchar(255) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`body` varchar(512) NOT NULL,
	`targetSection` enum('calendar','todo') NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`state` enum('pending','claimed','sent','skipped','cancelled') NOT NULL DEFAULT 'pending',
	`attemptCount` int NOT NULL DEFAULT 0,
	`claimToken` varchar(128),
	`claimedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushReminderDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushReminderDeliveries_deliveryKey_unique` UNIQUE(`deliveryKey`)
);
--> statement-breakpoint
CREATE TABLE `pushReminderPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`defaultLeadMinutes` int NOT NULL DEFAULT 10,
	`quietHoursStart` varchar(5),
	`quietHoursEnd` varchar(5),
	`timeZone` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushReminderPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushReminderPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `pushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpointHash` varchar(128) NOT NULL,
	`encryptedSubscription` text NOT NULL,
	`userAgent` varchar(512),
	`expiresAt` timestamp,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`lastError` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushSubscriptions_endpointHash_unique` UNIQUE(`endpointHash`)
);
--> statement-breakpoint
ALTER TABLE `pushReminderDeliveries` ADD CONSTRAINT `pushReminderDeliveries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pushReminderPreferences` ADD CONSTRAINT `pushReminderPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD CONSTRAINT `pushSubscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pushReminderDeliveries_due_idx` ON `pushReminderDeliveries` (`state`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `pushReminderDeliveries_user_idx` ON `pushReminderDeliveries` (`userId`);--> statement-breakpoint
CREATE INDEX `pushSubscriptions_user_status_idx` ON `pushSubscriptions` (`userId`,`status`);