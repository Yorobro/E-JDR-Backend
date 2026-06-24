CREATE TABLE `session_participants` (
	`session_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`character_sheet_id` char(36),
	`status` varchar(10) NOT NULL DEFAULT 'INVITED',
	`invited_at` datetime NOT NULL,
	`responded_at` datetime,
	CONSTRAINT `session_participants_session_id_user_id_pk` PRIMARY KEY(`session_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `status` varchar(10) DEFAULT 'PLANNED' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `started_at` datetime;--> statement-breakpoint
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_character_sheet_id_character_sheets_id_fk` FOREIGN KEY (`character_sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_session_participants_user_id` ON `session_participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_session_participants_sheet_id` ON `session_participants` (`character_sheet_id`);