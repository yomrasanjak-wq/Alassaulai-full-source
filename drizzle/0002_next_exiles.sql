ALTER TABLE `controlRequests` MODIFY COLUMN `status` enum('pending','reviewed','in_progress','completed','rejected') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `title` varchar(255) DEFAULT 'طلب جديد' NOT NULL;--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `requesterType` varchar(32) DEFAULT 'visitor' NOT NULL;--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `category` varchar(32) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `priority` varchar(16) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `assignee` varchar(32);--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `decisionNote` text;--> statement-breakpoint
ALTER TABLE `controlRequests` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;