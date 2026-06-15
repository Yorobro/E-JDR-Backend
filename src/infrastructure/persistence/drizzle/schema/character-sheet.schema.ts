import {
  mysqlTable,
  char,
  varchar,
  datetime,
  int,
  text,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { users } from "./auth.schema";
import { campaigns } from "./campaign.schema";

/** Table `character_sheets` — fiche de personnage (nom requis, détails NULLables). */
export const characterSheets = mysqlTable(
  "character_sheets",
  {
    id: char("id", { length: 36 }).primaryKey(),
    owner_id: char("owner_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    formation: varchar("formation", { length: 255 }),
    niveau: int("niveau"),
    peuple: varchar("peuple", { length: 255 }),
    sexe: varchar("sexe", { length: 10 }),
    taille_et_poids: varchar("taille_et_poids", { length: 255 }),
    age: int("age"),
    apparence: text("apparence"),
    dexterite: int("dexterite"),
    intelligence: int("intelligence"),
    perception: int("perception"),
    social: int("social"),
    vigueur: int("vigueur"),
    points_de_vie: int("points_de_vie"),
    points_de_magie: int("points_de_magie"),
    protection: int("protection"),
    purse_gold: int("purse_gold"),
    purse_silver: int("purse_silver"),
    purse_copper: int("purse_copper"),
    armures: text("armures"),
    armes: text("armes"),
    competences: text("competences"),
    equipement: text("equipement"),
    sorts_et_miracles: text("sorts_et_miracles"),
    notes: text("notes"),
  },
  (table) => [index("idx_character_sheets_owner_id").on(table.owner_id)],
);

/** Table `campaign_characters` — liaison N-N campagnes ↔ fiches. */
export const campaignCharacters = mysqlTable(
  "campaign_characters",
  {
    campaign_id: char("campaign_id", { length: 36 })
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    character_sheet_id: char("character_sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.campaign_id, table.character_sheet_id] }),
    index("idx_campaign_characters_sheet").on(table.character_sheet_id),
  ],
);
