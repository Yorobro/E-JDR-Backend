import { mysqlTable, char, varchar, datetime, index } from "drizzle-orm/mysql-core";
import { campaigns } from "./campaign.schema";

/** Table `sessions` — une session de jeu rattachée à une campagne (1‑N). */
export const sessions = mysqlTable(
  "sessions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    campaign_id: char("campaign_id", { length: 36 })
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    date: datetime("date", { mode: "date" }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("idx_sessions_campaign_id").on(table.campaign_id)],
);
