ALTER TABLE `armes` DROP FOREIGN KEY `armes_owner_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `armures` DROP FOREIGN KEY `armures_owner_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `competences` DROP FOREIGN KEY `competences_owner_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `equipements` DROP FOREIGN KEY `equipements_owner_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `formations` DROP FOREIGN KEY `formations_owner_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `peoples` DROP FOREIGN KEY `peoples_owner_id_users_id_fk`;
--> statement-breakpoint
DROP INDEX `idx_armes_owner_id` ON `armes`;--> statement-breakpoint
DROP INDEX `idx_armures_owner_id` ON `armures`;--> statement-breakpoint
DROP INDEX `idx_competences_owner_id` ON `competences`;--> statement-breakpoint
DROP INDEX `idx_equipements_owner_id` ON `equipements`;--> statement-breakpoint
DROP INDEX `idx_formations_owner_id` ON `formations`;--> statement-breakpoint
DROP INDEX `idx_peoples_owner_id` ON `peoples`;--> statement-breakpoint
ALTER TABLE `armes` DROP COLUMN `owner_id`;--> statement-breakpoint
ALTER TABLE `armures` DROP COLUMN `owner_id`;--> statement-breakpoint
ALTER TABLE `competences` DROP COLUMN `owner_id`;--> statement-breakpoint
ALTER TABLE `equipements` DROP COLUMN `owner_id`;--> statement-breakpoint
ALTER TABLE `formations` DROP COLUMN `owner_id`;--> statement-breakpoint
ALTER TABLE `peoples` DROP COLUMN `owner_id`;