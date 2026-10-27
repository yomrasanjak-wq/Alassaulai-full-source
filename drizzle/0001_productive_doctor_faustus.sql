CREATE TABLE `controlRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`command` text NOT NULL,
	`status` enum('pending','reviewed','completed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `controlRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guestMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imageUrl` text,
	`caption` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guestMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mediaItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mediaItems_id` PRIMARY KEY(`id`)
);
