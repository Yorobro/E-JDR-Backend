import {
  mysqlTable,
  char,
  varchar,
  datetime,
  index,
  primaryKey,
  unique,
  int,
  text,
} from "drizzle-orm/mysql-core";
import { friendGroups } from "./friend-group.schema";
import { characterSheets } from "./character-sheet.schema";

/**
 * Tables des **éléments de référence appartenant à un groupe** : formations, peuples, armes,
 * armures, compétences, équipements. Chaque élément appartient à un groupe (`group_id`),
 * porte un `name` unique par groupe, et sert de catalogue partagé dans lequel les fiches piochent.
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
  group_id: char("group_id", { length: 36 })
    .notNull()
    .references(() => friendGroups.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  created_at: datetime("created_at", { mode: "date" }).notNull(),
};

// formations et peoples ont leurs propres colonnes inline (avec stat + bonus en plus)
export const formations = mysqlTable(
  "formations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    stat: varchar("stat", { length: 20 }),
    bonus: int("bonus"),
  },
  (t) => [
    unique("uq_formations_group_name").on(t.group_id, t.name),
    index("idx_formations_group_id").on(t.group_id),
  ],
);

export const peoples = mysqlTable(
  "peoples",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    stat: varchar("stat", { length: 20 }),
    bonus: int("bonus"),
  },
  (t) => [
    unique("uq_peoples_group_name").on(t.group_id, t.name),
    index("idx_peoples_group_id").on(t.group_id),
  ],
);

export const armes = mysqlTable("armes", referenceColumns, (t) => [
  unique("uq_armes_group_name").on(t.group_id, t.name),
  index("idx_armes_group_id").on(t.group_id),
]);

// armures a ses propres colonnes inline (avec points_de_protection en plus, nullable)
export const armures = mysqlTable(
  "armures",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    points_de_protection: int("points_de_protection"),
  },
  (t) => [
    unique("uq_armures_group_name").on(t.group_id, t.name),
    index("idx_armures_group_id").on(t.group_id),
  ],
);

export const competences = mysqlTable("competences", referenceColumns, (t) => [
  unique("uq_competences_group_name").on(t.group_id, t.name),
  index("idx_competences_group_id").on(t.group_id),
]);

export const equipements = mysqlTable("equipements", referenceColumns, (t) => [
  unique("uq_equipements_group_name").on(t.group_id, t.name),
  index("idx_equipements_group_id").on(t.group_id),
]);

// sorts et miracles ont leurs propres colonnes inline (avec description en plus, nullable)
export const sorts = mysqlTable(
  "sorts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    description: text("description"),
  },
  (t) => [
    unique("uq_sorts_group_name").on(t.group_id, t.name),
    index("idx_sorts_group_id").on(t.group_id),
  ],
);

export const miracles = mysqlTable(
  "miracles",
  {
    id: char("id", { length: 36 }).primaryKey(),
    group_id: char("group_id", { length: 36 })
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    description: text("description"),
  },
  (t) => [
    unique("uq_miracles_group_name").on(t.group_id, t.name),
    index("idx_miracles_group_id").on(t.group_id),
  ],
);

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

export const sheetSorts = mysqlTable(
  "sheet_sorts",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    sort_id: char("sort_id", { length: 36 })
      .notNull()
      .references(() => sorts.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.sort_id] }),
    index("idx_sheet_sorts_sort").on(t.sort_id),
  ],
);

export const sheetMiracles = mysqlTable(
  "sheet_miracles",
  {
    sheet_id: char("sheet_id", { length: 36 })
      .notNull()
      .references(() => characterSheets.id, { onDelete: "cascade" }),
    miracle_id: char("miracle_id", { length: 36 })
      .notNull()
      .references(() => miracles.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sheet_id, t.miracle_id] }),
    index("idx_sheet_miracles_miracle").on(t.miracle_id),
  ],
);

// Table de jointure N‑N : une formation peut avoir plusieurs compétences associées.
export const formationCompetences = mysqlTable(
  "formation_competences",
  {
    formation_id: char("formation_id", { length: 36 })
      .notNull()
      .references(() => formations.id, { onDelete: "cascade" }),
    competence_id: char("competence_id", { length: 36 })
      .notNull()
      .references(() => competences.id, { onDelete: "cascade" }),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.formation_id, t.competence_id] }),
    index("idx_formation_competences_competence").on(t.competence_id),
  ],
);
