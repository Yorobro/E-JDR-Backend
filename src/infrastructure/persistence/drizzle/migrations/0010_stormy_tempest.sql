CREATE TABLE `miracles` (
	`id` char(36) NOT NULL,
	`group_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	`description` text,
	CONSTRAINT `miracles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_miracles_group_name` UNIQUE(`group_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `sheet_miracles` (
	`sheet_id` char(36) NOT NULL,
	`miracle_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_miracles_sheet_id_miracle_id_pk` PRIMARY KEY(`sheet_id`,`miracle_id`)
);
--> statement-breakpoint
CREATE TABLE `sheet_sorts` (
	`sheet_id` char(36) NOT NULL,
	`sort_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_sorts_sheet_id_sort_id_pk` PRIMARY KEY(`sheet_id`,`sort_id`)
);
--> statement-breakpoint
CREATE TABLE `sorts` (
	`id` char(36) NOT NULL,
	`group_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	`description` text,
	CONSTRAINT `sorts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sorts_group_name` UNIQUE(`group_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `miracles` ADD CONSTRAINT `miracles_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_miracles` ADD CONSTRAINT `sheet_miracles_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_miracles` ADD CONSTRAINT `sheet_miracles_miracle_id_miracles_id_fk` FOREIGN KEY (`miracle_id`) REFERENCES `miracles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_sorts` ADD CONSTRAINT `sheet_sorts_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_sorts` ADD CONSTRAINT `sheet_sorts_sort_id_sorts_id_fk` FOREIGN KEY (`sort_id`) REFERENCES `sorts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sorts` ADD CONSTRAINT `sorts_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_miracles_group_id` ON `miracles` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_miracles_miracle` ON `sheet_miracles` (`miracle_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_sorts_sort` ON `sheet_sorts` (`sort_id`);--> statement-breakpoint
CREATE INDEX `idx_sorts_group_id` ON `sorts` (`group_id`);--> statement-breakpoint
ALTER TABLE `character_sheets` DROP COLUMN `sorts_et_miracles`;