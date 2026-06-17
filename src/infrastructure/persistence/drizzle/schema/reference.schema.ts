import {
  mysqlTable,
  char,
  varchar,
  datetime,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/mysql-core";
import { users } from "./auth.schema";
import { characterSheets } from "./character-sheet.schema";

/**
 * Tables des **éléments de référence créés par l'utilisateur** : formations, peuples, armes,
 * armures, compétences, équipements. Chaque élément appartient à un utilisateur (`owner_id`),
 * porte un `name` unique par propriétaire, et sert de catalogue dans lequel les fiches piochent.
 *
 * - formations / peoples : référencés en **N‑1** par `character_sheets.formation_id` / `peuple_id`
 *   (cf. `character-sheet.schema.ts`), avec `ON DELETE set null`.
 * - armes / armures / competences / equipements : reliés aux fiches en **N‑N** via les tables de
 *   jointure ci-dessous (PK composite, `ON DELETE cascade`).
 *
 * Note import circulaire : ce fichier importe `characterSheets` et `character-sheet.schema.ts`
 * importe `formations`/`peoples` d'ici. Les références Drizzle étant **paresseuses** (`() => …`),
 * le cycle se résout à l'exécution sans problème.
 */

/** Modèle commun à toutes les tables de référence (un par type). */
const referenceColumns = {
  id: char("id", { length: 36 }).primaryKey(),
  owner_id: char("owner_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  created_at: datetime("created_at", { mode: "date" }).notNull(),
};

export const formations = mysqlTable("formations", referenceColumns, (t) => [
  unique("uq_formations_owner_name").on(t.owner_id, t.name),
  index("idx_formations_owner_id").on(t.owner_id),
]);

export const peoples = mysqlTable("peoples", referenceColumns, (t) => [
  unique("uq_peoples_owner_name").on(t.owner_id, t.name),
  index("idx_peoples_owner_id").on(t.owner_id),
]);

export const armes = mysqlTable("armes", referenceColumns, (t) => [
  unique("uq_armes_owner_name").on(t.owner_id, t.name),
  index("idx_armes_owner_id").on(t.owner_id),
]);

export const armures = mysqlTable("armures", referenceColumns, (t) => [
  unique("uq_armures_owner_name").on(t.owner_id, t.name),
  index("idx_armures_owner_id").on(t.owner_id),
]);

export const competences = mysqlTable("competences", referenceColumns, (t) => [
  unique("uq_competences_owner_name").on(t.owner_id, t.name),
  index("idx_competences_owner_id").on(t.owner_id),
]);

export const equipements = mysqlTable("equipements", referenceColumns, (t) => [
  unique("uq_equipements_owner_name").on(t.owner_id, t.name),
  index("idx_equipements_owner_id").on(t.owner_id),
]);

// Tables de jointure N‑N. Noms volontairement **courts** (`sheet_*`, colonne `sheet_id`) :
// MySQL limite les identifiants à 64 caractères, et les noms de contraintes FK auto-générés
// par Drizzle (`<table>_<col>_<reftable>_<refcol>_fk`) dépasseraient cette limite avec des
// noms longs comme `character_sheet_armures_character_sheet_id_character_sheets_id_fk`.
export const sheetArmes = mysqlTable(
  "sheet_armes",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    arme_id: char("arme_id", { length: 36 })
      .notNull()
      .references(() => armes.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.arme_id] }),
    index("idx_sheet_armes_arme").on(t.arme_id),
  ],
);

export const sheetArmures = mysqlTable(
  "sheet_armures",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    armure_id: char("armure_id", { length: 36 })
      .notNull()
      .references(() => armures.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.armure_id] }),
    index("idx_sheet_armures_armure").on(t.armure_id),
  ],
);

export const sheetCompetences = mysqlTable(
  "sheet_competences",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    competence_id: char("competence_id", { length: 36 })
      .notNull()
      .references(() => competences.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.competence_id] }),
    index("idx_sheet_competences_competence").on(t.competence_id),
  ],
);

export const sheetEquipements = mysqlTable(
  "sheet_equipements",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    equipement_id: char("equipement_id", { length: 36 })
      .notNull()
      .references(() => equipements.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.equipement_id] }),
    index("idx_sheet_equipements_equipement").on(t.equipement_id),
  ],
);
