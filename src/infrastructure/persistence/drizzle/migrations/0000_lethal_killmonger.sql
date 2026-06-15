CREATE TABLE `credentials` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` datetime,
	CONSTRAINT `credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_credentials_user_id` UNIQUE(`user_id`),
	CONSTRAINT `uq_credentials_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_refresh_tokens_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`pseudo` varchar(50) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` char(36) NOT NULL,
	`game_master_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_characters` (
	`campaign_id` char(36) NOT NULL,
	`character_sheet_id` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `campaign_characters_campaign_id_character_sheet_id_pk` PRIMARY KEY(`campaign_id`,`character_sheet_id`)
);
--> statement-breakpoint
CREATE TABLE `character_sheets` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime NOT NULL,
	`formation` varchar(255),
	`niveau` int,
	`peuple` varchar(255),
	`sexe` varchar(10),
	`taille_et_poids` varchar(255),
	`age` int,
	`apparence` text,
	`dexterite` int,
	`intelligence` int,
	`perception` int,
	`social` int,
	`vigueur` int,
	`points_de_vie` int,
	`points_de_magie` int,
	`protection` int,
	`purse_gold` int,
	`purse_silver` int,
	`purse_copper` int,
	`armures` text,
	`armes` text,
	`competences` text,
	`equipement` text,
	`sorts_et_miracles` text,
	`notes` text,
	CONSTRAINT `character_sheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_game_master_id_users_id_fk` FOREIGN KEY (`game_master_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_characters` ADD CONSTRAINT `campaign_characters_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_characters` ADD CONSTRAINT `campaign_characters_character_sheet_id_character_sheets_id_fk` FOREIGN KEY (`character_sheet_id`) REFERENCES `character_sheets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `character_sheets` ADD CONSTRAINT `character_sheets_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user_id` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_expires_at` ON `refresh_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_game_master_id` ON `campaigns` (`game_master_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_characters_sheet` ON `campaign_characters` (`character_sheet_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_owner_id` ON `character_sheets` (`owner_id`);