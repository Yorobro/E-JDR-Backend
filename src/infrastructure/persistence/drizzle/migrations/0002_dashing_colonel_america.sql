CREATE TABLE `armes` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `armes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_armes_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `armures` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `armures_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_armures_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `competences` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `competences_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_competences_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `equipements` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `equipements_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_equipements_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `formations` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `formations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_formations_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `peoples` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `peoples_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_peoples_owner_name` UNIQUE(`owner_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `sheet_armes` (
	`sheet_id` char(36) NOT NULL,
	`arme_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_armes_sheet_id_arme_id_pk` PRIMARY KEY(`sheet_id`,`arme_id`)
);
--> statement-breakpoint
CREATE TABLE `sheet_armures` (
	`sheet_id` char(36) NOT NULL,
	`armure_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_armures_sheet_id_armure_id_pk` PRIMARY KEY(`sheet_id`,`armure_id`)
);
--> statement-breakpoint
CREATE TABLE `sheet_competences` (
	`sheet_id` char(36) NOT NULL,
	`competence_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_competences_sheet_id_competence_id_pk` PRIMARY KEY(`sheet_id`,`competence_id`)
);
--> statement-breakpoint
CREATE TABLE `sheet_equipements` (
	`sheet_id` char(36) NOT NULL,
	`equipement_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `sheet_equipements_sheet_id_equipement_id_pk` PRIMARY KEY(`sheet_id`,`equipement_id`)
);
--> statement-breakpoint
ALTER TABLE `character_sheets` ADD `formation_id` char(36);--> statement-breakpoint
ALTER TABLE `character_sheets` ADD `peuple_id` char(36);--> statement-breakpoint
ALTER TABLE `armes` ADD CONSTRAINT `armes_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `armures` ADD CONSTRAINT `armures_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competences` ADD CONSTRAINT `competences_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `equipements` ADD CONSTRAINT `equipements_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `formations` ADD CONSTRAINT `formations_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peoples` ADD CONSTRAINT `peoples_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_armes` ADD CONSTRAINT `sheet_armes_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_armes` ADD CONSTRAINT `sheet_armes_arme_id_armes_id_fk` FOREIGN KEY (`arme_id`) REFERENCES `armes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_armures` ADD CONSTRAINT `sheet_armures_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_armures` ADD CONSTRAINT `sheet_armures_armure_id_armures_id_fk` FOREIGN KEY (`armure_id`) REFERENCES `armures`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_competences` ADD CONSTRAINT `sheet_competences_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_competences` ADD CONSTRAINT `sheet_competences_competence_id_competences_id_fk` FOREIGN KEY (`competence_id`) REFERENCES `competences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_equipements` ADD CONSTRAINT `sheet_equipements_sheet_id_character_sheets_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheet_equipements` ADD CONSTRAINT `sheet_equipements_equipement_id_equipements_id_fk` FOREIGN KEY (`equipement_id`) REFERENCES `equipements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_armes_owner_id` ON `armes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_armures_owner_id` ON `armures` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_competences_owner_id` ON `competences` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_equipements_owner_id` ON `equipements` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_formations_owner_id` ON `formations` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_peoples_owner_id` ON `peoples` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_armes_arme` ON `sheet_armes` (`arme_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_armures_armure` ON `sheet_armures` (`armure_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_competences_competence` ON `sheet_competences` (`competence_id`);--> statement-breakpoint
CREATE INDEX `idx_sheet_equipements_equipement` ON `sheet_equipements` (`equipement_id`);--> statement-breakpoint
ALTER TABLE `character_sheets` ADD CONSTRAINT `character_sheets_formation_id_formations_id_fk` FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `character_sheets` ADD CONSTRAINT `character_sheets_peuple_id_peoples_id_fk` FOREIGN KEY (`peuple_id`) REFERENCES `peoples`(`id`) ON DELETE set null ON UPDATE no action;