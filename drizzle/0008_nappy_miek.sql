CREATE TABLE `nativeOAuthHandoffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`verifierHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nativeOAuthHandoffs_id` PRIMARY KEY(`id`),
	CONSTRAINT `nativeOAuthHandoffs_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `nativePushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`encryptedToken` text NOT NULL,
	`platform` enum('android') NOT NULL DEFAULT 'android',
	`deviceLabel` varchar(128),
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`lastError` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nativePushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `nativePushSubscriptions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `personalReminderItems` ADD `leadMinutes` int;--> statement-breakpoint
ALTER TABLE `nativeOAuthHandoffs` ADD CONSTRAINT `nativeOAuthHandoffs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nativePushSubscriptions` ADD CONSTRAINT `nativePushSubscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `nativeOAuthHandoffs_user_expiry_idx` ON `nativeOAuthHandoffs` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `nativePushSubscriptions_user_status_idx` ON `nativePushSubscriptions` (`userId`,`status`);