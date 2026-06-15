import { mysqlTable, char, varchar, datetime, int, index } from "drizzle-orm/mysql-core";

/** Table `users` — identité métier. */
export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  pseudo: varchar("pseudo", { length: 50 }).notNull(),
  created_at: datetime("created_at", { mode: "date" }).notNull(),
});

/** Table `credentials` — données d'authentification, 1-1 avec users. */
export const credentials = mysqlTable("credentials", {
  id: char("id", { length: 36 }).primaryKey(),
  user_id: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique("uq_credentials_user_id"),
  email: varchar("email", { length: 255 }).notNull().unique("uq_credentials_email"),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  created_at: datetime("created_at", { mode: "date" }).notNull(),
  failed_attempts: int("failed_attempts").notNull().default(0),
  locked_until: datetime("locked_until", { mode: "date" }),
});

/** Table `refresh_tokens` — sessions révocables. */
export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: char("id", { length: 36 }).primaryKey(),
    user_id: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token_hash: char("token_hash", { length: 64 }).notNull().unique("uq_refresh_tokens_token_hash"),
    expires_at: datetime("expires_at", { mode: "date" }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("idx_refresh_tokens_user_id").on(table.user_id),
    index("idx_refresh_tokens_expires_at").on(table.expires_at),
  ],
);
