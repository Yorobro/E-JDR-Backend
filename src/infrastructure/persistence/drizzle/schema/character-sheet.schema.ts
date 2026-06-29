import { mysqlTable, char, varchar, datetime, int, text, index } from "drizzle-orm/mysql-core";
import { users } from "./auth.schema";
import { campaigns } from "./campaign.schema";
import { friendGroups } from "./friend-group.schema";
import { formations, peoples } from "./reference.schema";

/** Table `character_sheets` — fiche de personnage (nom requis, détails NULLables). */
export const characterSheets = mysqlTable(
  "character_sheets",
  {
    id: char("id", { length: 36 }).primaryKey(),
    owner_id: char("owner_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // group_id : le groupe d'amis auquel la fiche appartient (visibilité = tout le groupe, D3).
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    // campaign_id : la campagne **unique** à laquelle la fiche est rattachée (modèle « une fiche =
    // une campagne »). NOT NULL : une fiche existe toujours pour une campagne donnée. ON DELETE
    // cascade : si la campagne disparaît, ses fiches disparaissent.
    campaign_id: char("campaign_id", { length: 36 })
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // campaign_link_status : PENDING (en attente de validation du MJ) ou ACCEPTED (validée).
    campaign_link_status: varchar("campaign_link_status", { length: 20 }).notNull(),
    // formation / peuple : N‑1 vers les catalogues de l'utilisateur (nullable, SET NULL si l'élément est supprimé).
    formation_id: char("formation_id", { length: 36 }).references(() => formations.id, {
      onDelete: "set null",
    }),
    niveau: int("niveau"),
    peuple_id: char("peuple_id", { length: 36 }).references(() => peoples.id, {
      onDelete: "set null",
    }),
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
    // armes / armures / competences / equipement / sorts / miracles : désormais en N‑N via les
    // tables de jointure (cf. reference.schema.ts), plus de colonnes texte ici.
    notes: text("notes"),
  },
  (table) => [
    index("idx_character_sheets_owner_id").on(table.owner_id),
    index("idx_character_sheets_group_id").on(table.group_id),
    index("idx_character_sheets_campaign_id").on(table.campaign_id),
  ],
);
