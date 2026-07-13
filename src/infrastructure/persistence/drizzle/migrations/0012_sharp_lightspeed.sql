CREATE TABLE `peuple_stat_bonuses` (
	`peuple_id` char(36) NOT NULL,
	`stat` varchar(20) NOT NULL,
	`bonus` int NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `peuple_stat_bonuses_peuple_id_stat_pk` PRIMARY KEY(`peuple_id`,`stat`)
);
--> statement-breakpoint
ALTER TABLE `peuple_stat_bonuses` ADD CONSTRAINT `peuple_stat_bonuses_peuple_id_peoples_id_fk` FOREIGN KEY (`peuple_id`) REFERENCES `peoples`(`id`) ON DELETE cascade ON UPDATE no action;