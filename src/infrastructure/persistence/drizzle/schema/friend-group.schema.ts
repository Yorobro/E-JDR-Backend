import {
  mysqlTable,
  char,
  varchar,
  datetime,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/mysql-core";
import { users } from "./auth.schema";

export const friendGroups = mysqlTable(
  "friend_groups",
  {
    id: char("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    created_by: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("idx_friend_groups_created_by").on(table.created_by)],
);

export const groupMembers = mysqlTable(
  "group_members",
  {
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    user_id: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 10 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.group_id, table.user_id] }),
    index("idx_group_members_user_id").on(table.user_id),
  ],
);

export const groupInvitations = mysqlTable(
  "group_invitations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    invited_user_id: char("invited_user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invited_by: char("invited_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    status: varchar("status", { length: 10 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("idx_grp_inv_invited_user").on(table.invited_user_id),
    index("idx_grp_inv_group_id").on(table.group_id),
    unique("uq_grp_inv_pending").on(table.group_id, table.invited_user_id),
  ],
);
