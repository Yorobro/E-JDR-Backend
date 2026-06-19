CREATE TABLE `formation_competences` (
	`formation_id` char(36) NOT NULL,
	`competence_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `formation_competences_formation_id_competence_id_pk` PRIMARY KEY(`formation_id`,`competence_id`)
);
--> statement-breakpoint
ALTER TABLE `formations` ADD `stat` varchar(20);--> statement-breakpoint
ALTER TABLE `formations` ADD `bonus` int;--> statement-breakpoint
ALTER TABLE `peoples` ADD `stat` varchar(20);--> statement-breakpoint
ALTER TABLE `peoples` ADD `bonus` int;--> statement-breakpoint
ALTER TABLE `formation_competences` ADD CONSTRAINT `formation_competences_formation_id_formations_id_fk` FOREIGN KEY (`formation_id`) REFERENCES `formations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `formation_competences` ADD CONSTRAINT `formation_competences_competence_id_competences_id_fk` FOREIGN KEY (`competence_id`) REFERENCES `competences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_formation_competences_competence` ON `formation_competences` (`competence_id`);