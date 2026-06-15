import { mysqlTable, char, varchar, datetime, index } from "drizzle-orm/mysql-core";
import { users } from "./auth.schema";

/** Table `campaigns` — une campagne possédée par un MJ. */
export const campaigns = mysqlTable(
  "campaigns",
  {
    id: char("id", { length: 36 }).primaryKey(),
    game_master_id: char("game_master_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("idx_campaigns_game_master_id").on(table.game_master_id)],
);
