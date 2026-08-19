CREATE TABLE `calendarConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleSubject` varchar(255),
	`email` varchar(320) NOT NULL,
	`accountType` enum('google','workspace','demo') NOT NULL,
	`status` enum('pending','connected','reauth_required','disconnected','demo') NOT NULL DEFAULT 'pending',
	`scopes` text,
	`encryptedAccessToken` text,
	`encryptedRefreshToken` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendarConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarConnections_user_email_unique` UNIQUE(`userId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `calendarSyncStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkedCalendarId` int NOT NULL,
	`nextSyncToken` text,
	`lastSyncedAt` timestamp,
	`lastError` text,
	`syncStatus` enum('idle','syncing','healthy','attention') NOT NULL DEFAULT 'idle',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendarSyncStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarSyncStates_linkedCalendarId_unique` UNIQUE(`linkedCalendarId`)
);
--> statement-breakpoint
CREATE TABLE `calendarWatchChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkedCalendarId` int NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`resourceId` varchar(512) NOT NULL,
	`verificationToken` varchar(256) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendarWatchChannels_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarWatchChannels_channelId_unique` UNIQUE(`channelId`)
);
--> statement-breakpoint
CREATE TABLE `linkedCalendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`externalCalendarId` varchar(512) NOT NULL,
	`summary` varchar(255) NOT NULL,
	`timeZone` varchar(128),
	`color` varchar(32),
	`accessRole` varchar(64),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `linkedCalendars_id` PRIMARY KEY(`id`),
	CONSTRAINT `linkedCalendars_connection_external_unique` UNIQUE(`connectionId`,`externalCalendarId`)
);
--> statement-breakpoint
CREATE TABLE `syncedEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkedCalendarId` int NOT NULL,
	`externalEventId` varchar(1024) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`description` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`isAllDay` boolean NOT NULL DEFAULT false,
	`eventStatus` varchar(64) NOT NULL DEFAULT 'confirmed',
	`isDeleted` boolean NOT NULL DEFAULT false,
	`googleUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `syncedEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `syncedEvents_calendar_external_unique` UNIQUE(`linkedCalendarId`,`externalEventId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `calendarConnections` ADD CONSTRAINT `calendarConnections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarSyncStates` ADD CONSTRAINT `calendarSyncStates_linkedCalendarId_linkedCalendars_id_fk` FOREIGN KEY (`linkedCalendarId`) REFERENCES `linkedCalendars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarWatchChannels` ADD CONSTRAINT `calendarWatchChannels_linkedCalendarId_linkedCalendars_id_fk` FOREIGN KEY (`linkedCalendarId`) REFERENCES `linkedCalendars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `linkedCalendars` ADD CONSTRAINT `linkedCalendars_connectionId_calendarConnections_id_fk` FOREIGN KEY (`connectionId`) REFERENCES `calendarConnections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `syncedEvents` ADD CONSTRAINT `syncedEvents_linkedCalendarId_linkedCalendars_id_fk` FOREIGN KEY (`linkedCalendarId`) REFERENCES `linkedCalendars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `calendarConnections_user_idx` ON `calendarConnections` (`userId`);--> statement-breakpoint
CREATE INDEX `calendarWatchChannels_calendar_idx` ON `calendarWatchChannels` (`linkedCalendarId`);--> statement-breakpoint
CREATE INDEX `linkedCalendars_connection_idx` ON `linkedCalendars` (`connectionId`);--> statement-breakpoint
CREATE INDEX `syncedEvents_calendar_start_idx` ON `syncedEvents` (`linkedCalendarId`,`startAt`);