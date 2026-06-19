ALTER TABLE `character_sheets` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `character_sheets` ADD CONSTRAINT `character_sheets_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_character_sheets_group_id` ON `character_sheets` (`group_id`);