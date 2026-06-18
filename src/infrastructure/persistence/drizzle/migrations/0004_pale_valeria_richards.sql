CREATE TABLE `friend_groups` (
	`id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_by` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `friend_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_invitations` (
	`id` char(36) NOT NULL,
	`group_id` char(36) NOT NULL,
	`invited_user_id` char(36) NOT NULL,
	`invited_by` char(36) NOT NULL,
	`status` varchar(10) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `group_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_grp_inv_pending` UNIQUE(`group_id`,`invited_user_id`)
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` varchar(10) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `group_members_group_id_user_id_pk` PRIMARY KEY(`group_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `friend_groups` ADD CONSTRAINT `friend_groups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_invitations` ADD CONSTRAINT `group_invitations_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_invitations` ADD CONSTRAINT `group_invitations_invited_user_id_users_id_fk` FOREIGN KEY (`invited_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_invitations` ADD CONSTRAINT `group_invitations_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_friend_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_friend_groups_created_by` ON `friend_groups` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_grp_inv_invited_user` ON `group_invitations` (`invited_user_id`);--> statement-breakpoint
CREATE INDEX `idx_grp_inv_group_id` ON `group_invitations` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_user_id` ON `group_members` (`user_id`);