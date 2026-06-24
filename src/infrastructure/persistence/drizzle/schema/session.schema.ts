import { mysqlTable, char, varchar, datetime, index, primaryKey } from "drizzle-orm/mysql-core";
import { campaigns } from "./campaign.schema";
import { users } from "./auth.schema";
import { characterSheets } from "./character-sheet.schema";

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
    // PLANNED → LOBBY (invitations envoyées) → ACTIVE (session commencée) → ENDED
    status: varchar("status", { length: 10 }).notNull().default("PLANNED"),
    // null tant que le MJ n'a pas cliqué "commencer"
    started_at: datetime("started_at", { mode: "date" }),
  },
  (table) => [index("idx_sessions_campaign_id").on(table.campaign_id)],
);

/**
 * Table `session_participants` — joueurs invités à une session.
 *
 * - `status` : INVITED (invitation envoyée) | ACCEPTED (joueur a rejoint le lobby + choisi sa fiche)
 *              | REFUSED (joueur a refusé)
 * - `character_sheet_id` : null à l'invitation, rempli quand le joueur accepte et choisit sa fiche.
 *   SET NULL si la fiche est supprimée après la session (préserve l'historique de participation).
 * - `responded_at` : null tant que le joueur n'a pas répondu. Remis à null si le MJ ré-invite.
 */
export const sessionParticipants = mysqlTable(
  "session_participants",
  {
    session_id: char("session_id", { length: 36 })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    user_id: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    character_sheet_id: char("character_sheet_id", { length: 36 }).references(
      () => characterSheets.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 10 }).notNull().default("INVITED"),
    invited_at: datetime("invited_at", { mode: "date" }).notNull(),
    responded_at: datetime("responded_at", { mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.user_id] }),
    index("idx_session_participants_user_id").on(table.user_id),
    index("idx_session_participants_sheet_id").on(table.character_sheet_id),
  ],
);
