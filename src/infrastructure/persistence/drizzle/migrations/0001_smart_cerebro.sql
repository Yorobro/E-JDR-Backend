CREATE TABLE `sessions` (
	`id` char(36) NOT NULL,
	`campaign_id` char(36) NOT NULL,
	`title` varchar(120) NOT NULL,
	`date` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_sessions_campaign_id` ON `sessions` (`campaign_id`);