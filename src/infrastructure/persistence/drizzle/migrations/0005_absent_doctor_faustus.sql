ALTER TABLE `armes` DROP INDEX `uq_armes_owner_name`;--> statement-breakpoint
ALTER TABLE `armures` DROP INDEX `uq_armures_owner_name`;--> statement-breakpoint
ALTER TABLE `competences` DROP INDEX `uq_competences_owner_name`;--> statement-breakpoint
ALTER TABLE `equipements` DROP INDEX `uq_equipements_owner_name`;--> statement-breakpoint
ALTER TABLE `formations` DROP INDEX `uq_formations_owner_name`;--> statement-breakpoint
ALTER TABLE `peoples` DROP INDEX `uq_peoples_owner_name`;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `armes` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `armures` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `competences` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `equipements` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `formations` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `peoples` ADD `group_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `armes` ADD CONSTRAINT `uq_armes_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `armures` ADD CONSTRAINT `uq_armures_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `competences` ADD CONSTRAINT `uq_competences_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `equipements` ADD CONSTRAINT `uq_equipements_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `formations` ADD CONSTRAINT `uq_formations_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `peoples` ADD CONSTRAINT `uq_peoples_group_name` UNIQUE(`group_id`,`name`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `armes` ADD CONSTRAINT `armes_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `armures` ADD CONSTRAINT `armures_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competences` ADD CONSTRAINT `competences_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `equipements` ADD CONSTRAINT `equipements_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `formations` ADD CONSTRAINT `formations_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peoples` ADD CONSTRAINT `peoples_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_campaigns_group_id` ON `campaigns` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_armes_group_id` ON `armes` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_armures_group_id` ON `armures` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_competences_group_id` ON `competences` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_equipements_group_id` ON `equipements` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_formations_group_id` ON `formations` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_peoples_group_id` ON `peoples` (`group_id`);