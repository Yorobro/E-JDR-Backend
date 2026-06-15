# Refacto Drizzle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le SQL brut (`mysql2`) et le runner de migrations Umzug par Drizzle ORM (query builder typé + drizzle-kit), en préservant la frontière hexagonale et le pattern DAO/Mapper/Repository.

**Architecture:** Drizzle est confiné dans `src/infrastructure/persistence/`. `mysql2` reste comme driver bas niveau sous `drizzle-orm/mysql2`. Le schema TS (par feature) devient la source unique de vérité. Les DAOs utilisent le query builder Drizzle ; mappers, repos, ports, use cases, controllers restent inchangés. Le UnitOfWork passe à `db.transaction()`.

**Tech Stack:** Node 22, TypeScript strict, Express, MySQL 8.4, Vitest + Testcontainers, `drizzle-orm@^0.45`, `drizzle-kit@^0.31`.

---

## Conventions importantes (à respecter dans TOUTES les tâches)

1. **Colonnes Drizzle en snake_case.** Le premier argument de `char()/varchar()/int()/...` EST le nom de propriété JS du type inféré. Les mappers existants lisent `row.game_master_id`, `row.user_id`, `row.created_at` (snake_case). Pour garder les mappers **inchangés**, on nomme les propriétés du schema en snake_case identiques aux colonnes SQL. Exemple : `game_master_id: char("game_master_id", { length: 36 })`.
2. **`datetime` en mode `date`** partout : `datetime("created_at", { mode: "date" })`. Garantit que les mappers reçoivent des `Date`.
3. **Tests db** : nécessitent Docker (`npm run test:db`). Si Docker indisponible, le signaler et laisser le dev les lancer.
4. **Vert exigé à chaque fin d'étape** : `npm run build && npm run lint && npm test && npm run format:check`, plus `npm run test:db` quand Docker est dispo.
5. **Conventional commits** (`build:`, `feat:`, `refactor:`, `test:`, `chore:`, `docs:`) — le hook commitlint les exige.

---

## File Structure

**Créés :**
- `drizzle.config.ts` — config drizzle-kit (racine)
- `src/infrastructure/persistence/drizzle/schema/auth.schema.ts` — tables users, credentials, refresh_tokens
- `src/infrastructure/persistence/drizzle/schema/campaign.schema.ts` — table campaigns
- `src/infrastructure/persistence/drizzle/schema/character-sheet.schema.ts` — tables character_sheets, campaign_characters
- `src/infrastructure/persistence/drizzle/schema/index.ts` — ré-export (objet `schema`)
- `src/infrastructure/persistence/drizzle/DrizzleExecutor.ts` — type partagé db/tx
- `src/infrastructure/persistence/drizzle/migrations/` — généré par drizzle-kit (baseline `0000_*`)
- `tests/db/schemaEquivalence.test.ts` — test one-shot baseline vs anciens .sql

**Modifiés :**
- `package.json` — deps + scripts
- `src/infrastructure/persistence/mysql/MysqlConnection.ts` — expose l'instance drizzle
- `src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts` — `db.transaction()`
- `src/infrastructure/persistence/mysql/features/*/dao/*.ts` — query builder
- `src/infrastructure/persistence/mysql/features/*/create*Repositories.ts` — signature `DrizzleExecutor`
- `src/main.ts` — câblage
- `tests/db/globalSetup.ts` — migrator Drizzle au lieu d'Umzug
- `tests/db/dbTestUtils.ts` — inchangé probable (utilise un pool mysql2 brut pour les fixtures — OK)
- `tests/db/*.test.ts` — réécrits

**Supprimés (étape finale) :**
- `src/infrastructure/persistence/mysql/SqlExecutor.ts`
- `db/migrations/*.sql`, `db/umzug.ts`, `db/migrationRunner.ts`
- `tests/db/schemaEquivalence.test.ts` (après validation)

---

## ÉTAPE 0 — Socle commun

### Task 0.1 : Installer Drizzle et configurer les scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installer les dépendances**

Run:
```bash
npm install drizzle-orm
npm install -D drizzle-kit
```
Expected: ajout de `drizzle-orm` (dependencies) et `drizzle-kit` (devDependencies). Vérifier les versions installées (`^0.45` / `^0.31` attendues).

- [ ] **Step 2: Ajouter les scripts de migration dans `package.json`**

Dans la section `"scripts"`, ajouter après la ligne `"migrate:status"` :
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:custom": "drizzle-kit generate --custom",
```

- [ ] **Step 3: Vérifier que le build passe encore**

Run: `npm run build`
Expected: PASS (aucun usage de Drizzle encore, juste les deps installées).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add drizzle-orm and drizzle-kit dependencies"
```

---

### Task 0.2 : Écrire le schema Drizzle — auth

**Files:**
- Create: `src/infrastructure/persistence/drizzle/schema/auth.schema.ts`

État cible post-V007 (vérifié dans les DAOs + migrations) :
- `users` : id CHAR(36) PK, pseudo VARCHAR(50) NOT NULL, created_at DATETIME NOT NULL
- `credentials` : id CHAR(36) PK, user_id CHAR(36) NOT NULL UNIQUE FK→users CASCADE, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, failed_attempts INT NOT NULL DEFAULT 0, locked_until DATETIME NULL
- `refresh_tokens` : id CHAR(36) PK, user_id CHAR(36) NOT NULL FK→users CASCADE (index), token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL (index idx_refresh_tokens_expires_at), created_at DATETIME NOT NULL

- [ ] **Step 1: Écrire le fichier**

```ts
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
```

- [ ] **Step 2: Vérifier la compilation TS du fichier**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (le fichier compile ; pas encore importé ailleurs).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema/auth.schema.ts
git commit -m "feat(drizzle): add auth schema (users, credentials, refresh_tokens)"
```

---

### Task 0.3 : Écrire le schema Drizzle — campaign

**Files:**
- Create: `src/infrastructure/persistence/drizzle/schema/campaign.schema.ts`

État cible : `campaigns` : id CHAR(36) PK, game_master_id CHAR(36) NOT NULL FK→users CASCADE (index), name VARCHAR(120) NOT NULL, created_at DATETIME NOT NULL.

- [ ] **Step 1: Écrire le fichier**

```ts
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
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema/campaign.schema.ts
git commit -m "feat(drizzle): add campaign schema"
```

---

### Task 0.4 : Écrire le schema Drizzle — character-sheet

**Files:**
- Create: `src/infrastructure/persistence/drizzle/schema/character-sheet.schema.ts`

État cible :
- `character_sheets` : id CHAR(36) PK, owner_id CHAR(36) NOT NULL FK→users CASCADE (index), name VARCHAR(120) NOT NULL, created_at DATETIME NOT NULL, + 24 colonnes détail (V006) toutes NULL : formation/peuple/sexe/taille_et_poids VARCHAR(255 sauf sexe VARCHAR(10)), apparence/armures/armes/competences/equipement/sorts_et_miracles/notes TEXT, niveau/age/dexterite/intelligence/perception/social/vigueur/points_de_vie/points_de_magie/protection/purse_gold/purse_silver/purse_copper INT.
- `campaign_characters` : campaign_id CHAR(36) FK→campaigns CASCADE, character_sheet_id CHAR(36) FK→character_sheets CASCADE (index idx_campaign_characters_sheet), created_at DATETIME NOT NULL, PK composite (campaign_id, character_sheet_id).

- [ ] **Step 1: Écrire le fichier**

```ts
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
    // Identité
    formation: varchar("formation", { length: 255 }),
    niveau: int("niveau"),
    peuple: varchar("peuple", { length: 255 }),
    sexe: varchar("sexe", { length: 10 }),
    taille_et_poids: varchar("taille_et_poids", { length: 255 }),
    age: int("age"),
    apparence: text("apparence"),
    // Caractéristiques
    dexterite: int("dexterite"),
    intelligence: int("intelligence"),
    perception: int("perception"),
    social: int("social"),
    vigueur: int("vigueur"),
    // Combat
    points_de_vie: int("points_de_vie"),
    points_de_magie: int("points_de_magie"),
    protection: int("protection"),
    // Bourse
    purse_gold: int("purse_gold"),
    purse_silver: int("purse_silver"),
    purse_copper: int("purse_copper"),
    // Textes longs
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
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema/character-sheet.schema.ts
git commit -m "feat(drizzle): add character-sheet schema"
```

---

### Task 0.5 : Index du schema + config drizzle-kit

**Files:**
- Create: `src/infrastructure/persistence/drizzle/schema/index.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Écrire l'index du schema**

`src/infrastructure/persistence/drizzle/schema/index.ts` :
```ts
export * from "./auth.schema";
export * from "./campaign.schema";
export * from "./character-sheet.schema";
```

- [ ] **Step 2: Écrire `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/infrastructure/persistence/drizzle/schema/index.ts",
  out: "./src/infrastructure/persistence/drizzle/migrations",
  dbCredentials: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "e_jdr",
  },
});
```

- [ ] **Step 3: Générer la baseline**

Run: `npm run db:generate`
Expected: création de `src/infrastructure/persistence/drizzle/migrations/0000_*.sql` (CREATE TABLE des 6 tables) + `meta/0000_snapshot.json` + `meta/_journal.json`. Aucune connexion DB requise pour `generate`.

- [ ] **Step 4: Inspecter la baseline générée**

Lire le `0000_*.sql` et vérifier visuellement : 6 tables, types CHAR(36)/CHAR(64)/VARCHAR/INT/TEXT/DATETIME corrects, FK `ON DELETE CASCADE`, PK composite sur campaign_characters, index présents, `failed_attempts` DEFAULT 0.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema/index.ts drizzle.config.ts src/infrastructure/persistence/drizzle/migrations
git commit -m "feat(drizzle): add schema index, drizzle-kit config and baseline migration"
```

---

### Task 0.6 : Test d'équivalence de schéma (baseline vs anciens .sql)

**Files:**
- Create: `tests/db/schemaEquivalence.test.ts`

Ce test prouve que la baseline Drizzle produit le même schéma que V001→V007. Il démarre DEUX bases Testcontainers indépendantes, applique Umzug sur l'une et le migrator Drizzle sur l'autre, puis compare `SHOW CREATE TABLE` normalisé.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolve } from "node:path";
import { runMigrations } from "../../db/migrationRunner";

const TABLES = [
  "users",
  "credentials",
  "refresh_tokens",
  "campaigns",
  "character_sheets",
  "campaign_characters",
];

/** Normalise un DDL MySQL pour comparaison (espaces, AUTO_INCREMENT, ordre stable). */
function normalize(ddl: string): string {
  return ddl
    .replace(/AUTO_INCREMENT=\d+\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/ ,/g, ",")
    .trim();
}

async function showCreate(pool: Pool, table: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table}\``);
  return normalize(rows[0]["Create Table"] as string);
}

describe("Équivalence schéma baseline Drizzle vs migrations .sql historiques", () => {
  let umzugContainer: StartedMySqlContainer;
  let drizzleContainer: StartedMySqlContainer;
  let umzugPool: Pool;
  let drizzlePool: Pool;

  beforeAll(async () => {
    umzugContainer = await new MySqlContainer("mysql:8.4")
      .withDatabase("e_jdr")
      .withRootPassword("test")
      .start();
    drizzleContainer = await new MySqlContainer("mysql:8.4")
      .withDatabase("e_jdr")
      .withRootPassword("test")
      .start();

    umzugPool = mysql.createPool({
      host: umzugContainer.getHost(),
      port: umzugContainer.getPort(),
      user: "root",
      password: "test",
      database: "e_jdr",
      multipleStatements: true,
    });
    await runMigrations(umzugPool);

    drizzlePool = mysql.createPool({
      host: drizzleContainer.getHost(),
      port: drizzleContainer.getPort(),
      user: "root",
      password: "test",
      database: "e_jdr",
      multipleStatements: true,
    });
    await migrate(drizzle(drizzlePool), {
      migrationsFolder: resolve(__dirname, "../../src/infrastructure/persistence/drizzle/migrations"),
    });
  }, 180_000);

  afterAll(async () => {
    await umzugPool?.end().catch(() => {});
    await drizzlePool?.end().catch(() => {});
    await umzugContainer?.stop().catch(() => {});
    await drizzleContainer?.stop().catch(() => {});
  });

  it.each(TABLES)("table %s a un DDL équivalent", async (table) => {
    const umzugDdl = await showCreate(umzugPool, table);
    const drizzleDdl = await showCreate(drizzlePool, table);
    expect(drizzleDdl).toBe(umzugDdl);
  });
});
```

- [ ] **Step 2: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/schemaEquivalence.test.ts`
Expected: les 6 tables PASS. **Si une table échoue**, comparer les deux DDL affichés par Vitest et corriger le schema Drizzle (Tasks 0.2–0.4) jusqu'à équivalence, puis régénérer la baseline (`rm -r src/infrastructure/persistence/drizzle/migrations && npm run db:generate`). Différences attendues fréquentes : ordre des colonnes, nom d'index auto-généré, longueur de CHAR. Itérer jusqu'au vert.

> Note : si Docker n'est pas disponible, ce test ne peut pas être lancé par l'agent. Le signaler et demander au dev de le lancer ; ne pas continuer l'étape 0 tant qu'il n'est pas vert.

- [ ] **Step 3: Commit**

```bash
git add tests/db/schemaEquivalence.test.ts
git commit -m "test(drizzle): verify baseline schema equals historical sql migrations"
```

---

### Task 0.7 : DrizzleExecutor + instance drizzle dans MysqlConnection

**Files:**
- Create: `src/infrastructure/persistence/drizzle/DrizzleExecutor.ts`
- Modify: `src/infrastructure/persistence/mysql/MysqlConnection.ts`

- [ ] **Step 1: Créer le type `DrizzleExecutor`**

`src/infrastructure/persistence/drizzle/DrizzleExecutor.ts` :
```ts
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "./schema";

/**
 * Exécuteur Drizzle injecté dans les DAOs. Couvre à la fois l'instance hors transaction
 * (`db`) et l'instance transactionnelle (`tx`) fournie par `db.transaction()`, qui partagent
 * la même API de query builder. Remplace l'ancien `SqlExecutor` (mysql2 brut).
 */
export type DrizzleExecutor = MySql2Database<typeof schema>;
```

- [ ] **Step 2: Modifier `MysqlConnection` pour exposer l'instance drizzle**

Remplacer le contenu de `src/infrastructure/persistence/mysql/MysqlConnection.ts` par :
```ts
import mysql, { Pool, PoolOptions } from "mysql2/promise";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@infrastructure/persistence/drizzle/schema";

/**
 * Encapsule le pool MySQL (`mysql2`) et l'instance Drizzle construite par-dessus.
 *
 * `mysql2` reste le driver bas niveau (protocole, pool) ; Drizzle s'appuie dessus pour le
 * query builder typé. Tous les DAO reçoivent l'instance `db` (ou une transaction dérivée).
 */
export class MysqlConnection {
  private readonly pool: Pool;
  private readonly db: MySql2Database<typeof schema>;

  constructor(options: PoolOptions) {
    this.pool = mysql.createPool(options);
    this.db = drizzle(this.pool, { schema, mode: "default" });
  }

  /** Donne accès à l'instance Drizzle (mode normal, hors transaction). */
  public getDb(): MySql2Database<typeof schema> {
    return this.db;
  }

  /** Donne accès au pool sous-jacent (migrations, fixtures de test). */
  public getPool(): Pool {
    return this.pool;
  }

  /** Ferme proprement le pool (à l'arrêt de l'application). */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (MysqlConnection compile ; les DAOs utilisent encore SqlExecutor — non cassé).

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/persistence/drizzle/DrizzleExecutor.ts src/infrastructure/persistence/mysql/MysqlConnection.ts
git commit -m "feat(drizzle): expose drizzle instance from MysqlConnection"
```

---

### Task 0.8 : Basculer l'infra de test sur le migrator Drizzle

**Files:**
- Modify: `tests/db/globalSetup.ts`

Le setup global applique aujourd'hui Umzug (`runMigrations`). On le bascule sur le migrator Drizzle pour que les bases de test neuves soient créées par la baseline.

- [ ] **Step 1: Modifier `globalSetup.ts`**

Remplacer l'import et l'appel de migration. Remplacer :
```ts
import { runMigrations } from "../../db/migrationRunner";
```
par :
```ts
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolve } from "node:path";
```
puis remplacer le bloc `try { await runMigrations(pool); }` par :
```ts
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(
        __dirname,
        "../../src/infrastructure/persistence/drizzle/migrations",
      ),
    });
  } catch (error) {
```
(le reste du `catch`/`finally` est inchangé).

- [ ] **Step 2: Lancer toute la suite db pour valider la bascule (Docker requis)**

Run: `npm run test:db`
Expected: les suites db existantes passent encore (les DAOs sont toujours en SQL brut, la base est maintenant migrée par Drizzle — le schéma est identique grâce à Task 0.6). Le test `schemaEquivalence` passe aussi.

> Si Docker indisponible : signaler, faire lancer par le dev.

- [ ] **Step 3: Commit**

```bash
git add tests/db/globalSetup.ts
git commit -m "test(drizzle): migrate test containers with drizzle migrator"
```

---

### Étape 0 — Vérification finale

- [ ] Run: `npm run build` → PASS
- [ ] Run: `npm run lint` → PASS (0 warning)
- [ ] Run: `npm test` → PASS (unit + intégration ; pas de Docker requis pour le run principal sauf si certaines suites l'exigent)
- [ ] Run: `npm run test:db` → PASS (Docker requis)
- [ ] Run: `npm run format:check` → PASS

---

## ÉTAPE 1 — Auth (DAOs → Drizzle)

> Pour chaque DAO : réécrire en query builder, garder la même API publique (signatures), garder le type `XxxRow` mais le dériver de `$inferSelect`. Le mapper reste inchangé.

### Task 1.1 : UserDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/auth/dao/UserDao.ts`
- Test: `tests/db/UserDao.test.ts` (réécrit)

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `UserDao.ts` par :
```ts
import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { users } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `users` (type inféré du schema Drizzle). */
export type UserRow = typeof users.$inferSelect;

/** DAO de la table `users` : query builder Drizzle, une seule table, lignes brutes. */
export class UserDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: { id: string; pseudo: string; created_at: Date }): Promise<void> {
    await this.executor.insert(users).values(row);
  }

  public async findById(id: string): Promise<UserRow | null> {
    const rows = await this.executor.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
```

- [ ] **Step 2: Réécrire le test db**

Remplacer le contenu de `tests/db/UserDao.test.ts` par :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { UserDao } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";
import { createTestPool, clearAllTables } from "./dbTestUtils";

describe("UserDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: UserDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new UserDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
  });

  it("insère puis relit un utilisateur par id", async () => {
    const createdAt = new Date("2026-01-01T10:00:00Z");
    await dao.insert({ id: "u-1", pseudo: "Gandalf", created_at: createdAt });

    const row = await dao.findById("u-1");
    expect(row).not.toBeNull();
    expect(row?.id).toBe("u-1");
    expect(row?.pseudo).toBe("Gandalf");
    expect(row?.created_at).toBeInstanceOf(Date);
  });

  it("retourne null si l'utilisateur n'existe pas", async () => {
    expect(await dao.findById("absent")).toBeNull();
  });
});
```

- [ ] **Step 3: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/UserDao.test.ts`
Expected: PASS.

- [ ] **Step 4: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/auth/dao/UserDao.ts tests/db/UserDao.test.ts
git commit -m "refactor(drizzle): rewrite UserDao with query builder"
```

---

### Task 1.2 : CredentialDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/auth/dao/CredentialDao.ts`
- Test: `tests/db/CredentialDao.test.ts` (réécrit)

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `CredentialDao.ts` par :
```ts
import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { credentials } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `credentials` (type inféré du schema Drizzle). */
export type CredentialRow = typeof credentials.$inferSelect;

/** DAO de la table `credentials` : query builder Drizzle. */
export class CredentialDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    failed_attempts: number;
    locked_until: Date | null;
  }): Promise<void> {
    await this.executor.insert(credentials).values(row);
  }

  public async findByEmail(email: string): Promise<CredentialRow | null> {
    const rows = await this.executor
      .select()
      .from(credentials)
      .where(eq(credentials.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  public async findByUserId(userId: string): Promise<CredentialRow | null> {
    const rows = await this.executor
      .select()
      .from(credentials)
      .where(eq(credentials.user_id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  public async existsByEmail(email: string): Promise<boolean> {
    const rows = await this.executor
      .select({ id: credentials.id })
      .from(credentials)
      .where(eq(credentials.email, email))
      .limit(1);
    return rows.length > 0;
  }

  public async update(
    id: string,
    data: { failed_attempts: number; locked_until: Date | null },
  ): Promise<void> {
    await this.executor
      .update(credentials)
      .set({ failed_attempts: data.failed_attempts, locked_until: data.locked_until })
      .where(eq(credentials.id, id));
  }
}
```

- [ ] **Step 2: Réécrire le test db**

Remplacer le contenu de `tests/db/CredentialDao.test.ts` par :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CredentialDao } from "@infrastructure/persistence/mysql/features/auth/dao/CredentialDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CredentialDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CredentialDao;
  const createdAt = new Date("2026-01-01T10:00:00Z");

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CredentialDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "u-1");
  });

  function baseRow() {
    return {
      id: "c-1",
      user_id: "u-1",
      email: "a@b.c",
      password_hash: "hash",
      created_at: createdAt,
      failed_attempts: 0,
      locked_until: null,
    };
  }

  it("insère puis relit par email et par user_id", async () => {
    await dao.insert(baseRow());

    const byEmail = await dao.findByEmail("a@b.c");
    expect(byEmail?.id).toBe("c-1");
    expect(byEmail?.failed_attempts).toBe(0);
    expect(byEmail?.locked_until).toBeNull();

    const byUser = await dao.findByUserId("u-1");
    expect(byUser?.id).toBe("c-1");
  });

  it("existsByEmail reflète la présence", async () => {
    expect(await dao.existsByEmail("a@b.c")).toBe(false);
    await dao.insert(baseRow());
    expect(await dao.existsByEmail("a@b.c")).toBe(true);
  });

  it("met à jour le verrouillage", async () => {
    await dao.insert(baseRow());
    const lockedUntil = new Date("2026-02-01T00:00:00Z");
    await dao.update("c-1", { failed_attempts: 3, locked_until: lockedUntil });

    const row = await dao.findByEmail("a@b.c");
    expect(row?.failed_attempts).toBe(3);
    expect(row?.locked_until).toBeInstanceOf(Date);
  });

  it("rejette un credential sans user existant (FK)", async () => {
    await expect(
      dao.insert({ ...baseRow(), id: "c-2", user_id: "fantome" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/CredentialDao.test.ts`
Expected: PASS.

- [ ] **Step 4: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/auth/dao/CredentialDao.ts tests/db/CredentialDao.test.ts
git commit -m "refactor(drizzle): rewrite CredentialDao with query builder"
```

---

### Task 1.3 : RefreshTokenDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/auth/dao/RefreshTokenDao.ts`
- Test: `tests/db/RefreshTokenDao.test.ts` (réécrit)

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `RefreshTokenDao.ts` par :
```ts
import { eq, lt } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { refreshTokens } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `refresh_tokens` (type inféré du schema Drizzle). */
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

/** DAO de la table `refresh_tokens` : query builder Drizzle. */
export class RefreshTokenDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(refreshTokens).values(row);
  }

  public async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const rows = await this.executor
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token_hash, tokenHash))
      .limit(1);
    return rows[0] ?? null;
  }

  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.executor.delete(refreshTokens).where(eq(refreshTokens.token_hash, tokenHash));
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await this.executor.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
  }

  public async deleteExpired(now: Date): Promise<void> {
    await this.executor.delete(refreshTokens).where(lt(refreshTokens.expires_at, now));
  }
}
```

- [ ] **Step 2: Réécrire le test db**

Remplacer le contenu de `tests/db/RefreshTokenDao.test.ts` par :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/features/auth/dao/RefreshTokenDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("RefreshTokenDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: RefreshTokenDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new RefreshTokenDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "u-1");
  });

  function row(id: string, tokenHash: string, expiresAt: Date) {
    return {
      id,
      user_id: "u-1",
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date("2026-01-01T10:00:00Z"),
    };
  }

  it("insère puis relit par empreinte", async () => {
    await dao.insert(row("t-1", "h".repeat(64), new Date("2026-12-31T00:00:00Z")));
    const found = await dao.findByTokenHash("h".repeat(64));
    expect(found?.id).toBe("t-1");
  });

  it("supprime par empreinte", async () => {
    await dao.insert(row("t-1", "a".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.deleteByTokenHash("a".repeat(64));
    expect(await dao.findByTokenHash("a".repeat(64))).toBeNull();
  });

  it("supprime tous les tokens d'un utilisateur", async () => {
    await dao.insert(row("t-1", "b".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.insert(row("t-2", "c".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.deleteAllForUser("u-1");
    expect(await dao.findByTokenHash("b".repeat(64))).toBeNull();
    expect(await dao.findByTokenHash("c".repeat(64))).toBeNull();
  });

  it("purge uniquement les tokens expirés", async () => {
    await dao.insert(row("t-old", "d".repeat(64), new Date("2025-01-01T00:00:00Z")));
    await dao.insert(row("t-new", "e".repeat(64), new Date("2027-01-01T00:00:00Z")));
    await dao.deleteExpired(new Date("2026-06-15T00:00:00Z"));
    expect(await dao.findByTokenHash("d".repeat(64))).toBeNull();
    expect(await dao.findByTokenHash("e".repeat(64))).not.toBeNull();
  });
});
```

- [ ] **Step 3: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/RefreshTokenDao.test.ts`
Expected: PASS.

- [ ] **Step 4: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/auth/dao/RefreshTokenDao.ts tests/db/RefreshTokenDao.test.ts
git commit -m "refactor(drizzle): rewrite RefreshTokenDao with query builder"
```

---

### Task 1.4 : Re-signer createAuthRepositories

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/auth/createAuthRepositories.ts`

- [ ] **Step 1: Changer le type du paramètre**

Dans `createAuthRepositories.ts`, remplacer :
```ts
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";
```
par :
```ts
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
```
et remplacer la signature `executor: SqlExecutor` par `executor: DrizzleExecutor`.

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (les DAOs auth acceptent désormais un DrizzleExecutor).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/auth/createAuthRepositories.ts
git commit -m "refactor(drizzle): wire auth repositories on DrizzleExecutor"
```

---

## ÉTAPE 2 — Campaign

### Task 2.1 : CampaignDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/campaign/dao/CampaignDao.ts`
- Test: `tests/db/CampaignDao.test.ts` (réécrit — adapter l'existant)

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `CampaignDao.ts` par :
```ts
import { eq, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { campaigns } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `campaigns` (type inféré du schema Drizzle). */
export type CampaignRow = typeof campaigns.$inferSelect;

/** DAO de la table `campaigns` : query builder Drizzle. */
export class CampaignDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    game_master_id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(campaigns).values(row);
  }

  public async findByGameMasterId(gameMasterId: string): Promise<CampaignRow[]> {
    return this.executor
      .select()
      .from(campaigns)
      .where(eq(campaigns.game_master_id, gameMasterId))
      .orderBy(desc(campaigns.created_at));
  }

  public async findById(id: string): Promise<CampaignRow | null> {
    const rows = await this.executor.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(campaigns).where(eq(campaigns.id, id));
  }
}
```

- [ ] **Step 2: Réécrire le test db**

Remplacer le contenu de `tests/db/CampaignDao.test.ts` par :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CampaignDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CampaignDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CampaignDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1");
  });

  function row(id: string, name: string, createdAt: Date) {
    return { id, game_master_id: "mj-1", name, created_at: createdAt };
  }

  it("insère puis relit par id", async () => {
    await dao.insert(row("c-1", "Donjon", new Date("2026-01-01T10:00:00Z")));
    const found = await dao.findById("c-1");
    expect(found?.id).toBe("c-1");
    expect(found?.name).toBe("Donjon");
    expect(found?.created_at).toBeInstanceOf(Date);
  });

  it("liste les campagnes d'un MJ, plus récentes d'abord", async () => {
    await dao.insert(row("c-old", "Vieux", new Date("2026-01-01T10:00:00Z")));
    await dao.insert(row("c-new", "Neuf", new Date("2026-03-01T10:00:00Z")));
    const list = await dao.findByGameMasterId("mj-1");
    expect(list.map((c) => c.id)).toEqual(["c-new", "c-old"]);
  });

  it("retourne null si absente", async () => {
    expect(await dao.findById("absent")).toBeNull();
  });

  it("supprime par id", async () => {
    await dao.insert(row("c-1", "X", new Date("2026-01-01T10:00:00Z")));
    await dao.deleteById("c-1");
    expect(await dao.findById("c-1")).toBeNull();
  });

  it("rejette une campagne sans MJ existant (FK)", async () => {
    await expect(
      dao.insert({ id: "c-x", game_master_id: "fantome", name: "X", created_at: new Date() }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/CampaignDao.test.ts`
Expected: PASS.

- [ ] **Step 4: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/campaign/dao/CampaignDao.ts tests/db/CampaignDao.test.ts
git commit -m "refactor(drizzle): rewrite CampaignDao with query builder"
```

---

### Task 2.2 : Re-signer createCampaignRepositories

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/campaign/createCampaignRepositories.ts`

- [ ] **Step 1: Changer le type du paramètre**

Remplacer l'import `SqlExecutor` par `DrizzleExecutor` (depuis `@infrastructure/persistence/drizzle/DrizzleExecutor`) et la signature `executor: SqlExecutor` par `executor: DrizzleExecutor`.

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/campaign/createCampaignRepositories.ts
git commit -m "refactor(drizzle): wire campaign repositories on DrizzleExecutor"
```

---

## ÉTAPE 3 — Character-sheet (le gros morceau)

### Task 3.1 : CharacterSheetDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao.ts`
- Test: `tests/db/CharacterSheetDao.test.ts` (réécrit)

On supprime la machinerie `ALL_COLUMNS`/`DETAIL_COLUMNS`/`valuesOf`/placeholders. `CharacterSheetWriteRow` reste exporté (consommé par le mapper) mais devient un alias du type d'insert Drizzle. La projection « nom seul » des listes utilise un `.select({...})` explicite.

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `CharacterSheetDao.ts` par :
```ts
import { eq, and, desc, ne, notExists } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { characterSheets, campaignCharacters } from "@infrastructure/persistence/drizzle/schema";

/** Ligne complète `character_sheets` (type inféré : toutes colonnes). */
export type CharacterSheetRow = typeof characterSheets.$inferSelect;

/** Valeurs prêtes pour l'écriture d'une fiche complète (type d'insert Drizzle). */
export type CharacterSheetWriteRow = typeof characterSheets.$inferInsert;

/** Projection « résumé » (liste) : seules les colonnes d'en-tête. */
export type CharacterSheetSummaryRow = Pick<
  CharacterSheetRow,
  "id" | "owner_id" | "name" | "created_at"
>;

/** Colonnes éditables par `update` (nom + tous les détails, hors clés techniques). */
const EDITABLE = {
  name: characterSheets.name,
  formation: characterSheets.formation,
  niveau: characterSheets.niveau,
  peuple: characterSheets.peuple,
  sexe: characterSheets.sexe,
  taille_et_poids: characterSheets.taille_et_poids,
  age: characterSheets.age,
  apparence: characterSheets.apparence,
  dexterite: characterSheets.dexterite,
  intelligence: characterSheets.intelligence,
  perception: characterSheets.perception,
  social: characterSheets.social,
  vigueur: characterSheets.vigueur,
  points_de_vie: characterSheets.points_de_vie,
  points_de_magie: characterSheets.points_de_magie,
  protection: characterSheets.protection,
  purse_gold: characterSheets.purse_gold,
  purse_silver: characterSheets.purse_silver,
  purse_copper: characterSheets.purse_copper,
  armures: characterSheets.armures,
  armes: characterSheets.armes,
  competences: characterSheets.competences,
  equipement: characterSheets.equipement,
  sorts_et_miracles: characterSheets.sorts_et_miracles,
  notes: characterSheets.notes,
};

/** Projection en-tête réutilisée par les listes. */
const SUMMARY = {
  id: characterSheets.id,
  owner_id: characterSheets.owner_id,
  name: characterSheets.name,
  created_at: characterSheets.created_at,
};

/** DAO de la table `character_sheets` : query builder Drizzle. */
export class CharacterSheetDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: CharacterSheetWriteRow): Promise<void> {
    await this.executor.insert(characterSheets).values(row);
  }

  public async update(row: CharacterSheetWriteRow): Promise<void> {
    await this.executor
      .update(characterSheets)
      .set({
        name: row.name,
        formation: row.formation,
        niveau: row.niveau,
        peuple: row.peuple,
        sexe: row.sexe,
        taille_et_poids: row.taille_et_poids,
        age: row.age,
        apparence: row.apparence,
        dexterite: row.dexterite,
        intelligence: row.intelligence,
        perception: row.perception,
        social: row.social,
        vigueur: row.vigueur,
        points_de_vie: row.points_de_vie,
        points_de_magie: row.points_de_magie,
        protection: row.protection,
        purse_gold: row.purse_gold,
        purse_silver: row.purse_silver,
        purse_copper: row.purse_copper,
        armures: row.armures,
        armes: row.armes,
        competences: row.competences,
        equipement: row.equipement,
        sorts_et_miracles: row.sorts_et_miracles,
        notes: row.notes,
      })
      .where(eq(characterSheets.id, row.id));
  }

  public async findByOwnerId(ownerId: string): Promise<CharacterSheetSummaryRow[]> {
    return this.executor
      .select(SUMMARY)
      .from(characterSheets)
      .where(eq(characterSheets.owner_id, ownerId))
      .orderBy(desc(characterSheets.created_at));
  }

  public async findById(id: string): Promise<CharacterSheetRow | null> {
    const rows = await this.executor
      .select()
      .from(characterSheets)
      .where(eq(characterSheets.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(characterSheets).where(eq(characterSheets.id, id));
  }

  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheetSummaryRow[]> {
    return this.executor
      .select(SUMMARY)
      .from(characterSheets)
      .where(
        and(
          ne(characterSheets.owner_id, gameMasterId),
          notExists(
            this.executor
              .select({ one: campaignCharacters.campaign_id })
              .from(campaignCharacters)
              .where(
                and(
                  eq(campaignCharacters.character_sheet_id, characterSheets.id),
                  eq(campaignCharacters.campaign_id, campaignId),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(characterSheets.created_at));
  }
}
```

> Note pour l'implémenteur : `EDITABLE` n'est pas référencé dans le code ci-dessus (l'`update` liste les champs en dur pour la sûreté de typage Drizzle). Le supprimer pour éviter un `noUnusedLocals`. Il est documenté ici pour mémoire de l'intention « colonnes éditables ». **Ne pas le coller dans le fichier.**

- [ ] **Step 2: Vérifier le mapper consommateur**

Lire `src/infrastructure/persistence/mysql/features/character-sheet/mappers/CharacterSheetMapper.ts`. Confirmer qu'il lit `row.<colonne_snake_case>` (ex. `row.owner_id`, `row.points_de_vie`) — ces clés existent à l'identique dans le type inféré, donc le mapper reste inchangé. Si le mapper distingue ligne complète vs résumé, vérifier que `findByOwnerId` (résumé) et `findById` (complet) renvoient les bonnes formes.

- [ ] **Step 3: Réécrire le test db**

Remplacer le contenu de `tests/db/CharacterSheetDao.test.ts` par un test couvrant : insert+findById (toutes colonnes), update (modifie name + détails, ne touche pas owner_id/created_at), findByOwnerId (résumé, tri desc), deleteById, FK rejette owner inexistant, et `findLinkableForCampaign` (exclut les fiches du MJ et les fiches déjà liées). Modèle :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import {
  CharacterSheetDao,
  CharacterSheetWriteRow,
} from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/** Construit une ligne d'écriture complète avec des détails par défaut à null. */
function writeRow(over: Partial<CharacterSheetWriteRow>): CharacterSheetWriteRow {
  return {
    id: "s-1",
    owner_id: "owner-1",
    name: "Aragorn",
    created_at: new Date("2026-01-01T10:00:00Z"),
    formation: null,
    niveau: null,
    peuple: null,
    sexe: null,
    taille_et_poids: null,
    age: null,
    apparence: null,
    dexterite: null,
    intelligence: null,
    perception: null,
    social: null,
    vigueur: null,
    points_de_vie: null,
    points_de_magie: null,
    protection: null,
    purse_gold: null,
    purse_silver: null,
    purse_copper: null,
    armures: null,
    armes: null,
    competences: null,
    equipement: null,
    sorts_et_miracles: null,
    notes: null,
    ...over,
  };
}

describe("CharacterSheetDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CharacterSheetDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CharacterSheetDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "owner-1");
    await insertUser(pool, "mj-1");
  });

  it("insère et relit une fiche complète", async () => {
    await dao.insert(writeRow({ niveau: 3, points_de_vie: 12, purse_gold: 5 }));
    const found = await dao.findById("s-1");
    expect(found?.name).toBe("Aragorn");
    expect(found?.niveau).toBe(3);
    expect(found?.points_de_vie).toBe(12);
    expect(found?.purse_gold).toBe(5);
    expect(found?.created_at).toBeInstanceOf(Date);
  });

  it("met à jour name + détails sans toucher owner/created_at", async () => {
    const created = new Date("2026-01-01T10:00:00Z");
    await dao.insert(writeRow({ created_at: created }));
    await dao.update(writeRow({ name: "Frodo", niveau: 7, created_at: new Date("2030-01-01") }));
    const found = await dao.findById("s-1");
    expect(found?.name).toBe("Frodo");
    expect(found?.niveau).toBe(7);
    expect(found?.owner_id).toBe("owner-1");
    expect(found?.created_at.getTime()).toBe(created.getTime());
  });

  it("liste les fiches d'un propriétaire (résumé, plus récentes d'abord)", async () => {
    await dao.insert(writeRow({ id: "s-old", created_at: new Date("2026-01-01T10:00:00Z") }));
    await dao.insert(writeRow({ id: "s-new", created_at: new Date("2026-03-01T10:00:00Z") }));
    const list = await dao.findByOwnerId("owner-1");
    expect(list.map((s) => s.id)).toEqual(["s-new", "s-old"]);
    expect(list[0]).not.toHaveProperty("niveau");
  });

  it("supprime par id", async () => {
    await dao.insert(writeRow({}));
    await dao.deleteById("s-1");
    expect(await dao.findById("s-1")).toBeNull();
  });

  it("rejette une fiche sans owner existant (FK)", async () => {
    await expect(dao.insert(writeRow({ id: "s-x", owner_id: "fantome" }))).rejects.toThrow();
  });

  it("findLinkableForCampaign exclut les fiches du MJ et celles déjà liées", async () => {
    // campagne du MJ mj-1
    await pool.execute("INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?,?,?,?)", [
      "camp-1",
      "mj-1",
      "Camp",
      new Date("2026-01-01T10:00:00Z"),
    ]);
    // fiche du MJ → exclue
    await dao.insert(writeRow({ id: "s-mj", owner_id: "mj-1" }));
    // fiche d'un joueur déjà liée → exclue
    await dao.insert(writeRow({ id: "s-linked", owner_id: "owner-1" }));
    await pool.execute(
      "INSERT INTO campaign_characters (campaign_id, character_sheet_id, created_at) VALUES (?,?,?)",
      ["camp-1", "s-linked", new Date("2026-01-02T10:00:00Z")],
    );
    // fiche d'un joueur non liée → attendue
    await dao.insert(writeRow({ id: "s-free", owner_id: "owner-1" }));

    const linkable = await dao.findLinkableForCampaign("mj-1", "camp-1");
    expect(linkable.map((s) => s.id)).toEqual(["s-free"]);
  });
});
```

- [ ] **Step 4: Lancer le test (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/CharacterSheetDao.test.ts`
Expected: PASS (en particulier `findLinkableForCampaign`).

- [ ] **Step 5: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao.ts tests/db/CharacterSheetDao.test.ts
git commit -m "refactor(drizzle): rewrite CharacterSheetDao with query builder"
```

---

### Task 3.2 : CampaignCharacterDao → Drizzle

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao.ts`
- Test: `tests/db/CampaignCharacterDao.test.ts` (nouveau fichier dédié)

Méthodes existantes (à préserver à l'identique côté signature) : `insert`, `delete`, `existsByCampaignAndSheet`, `findSheetsByCampaignId` (JOIN vers character_sheets, projection résumé), `findCampaignViewsBySheetId` (JOIN campaigns + users, renvoie campaign_id/campaign_name/game_master_pseudo). Les types de retour `CharacterSheetRow`-résumé et `SheetCampaignViewRow` restent consommés par le repo/mapper.

- [ ] **Step 1: Réécrire le DAO**

Remplacer le contenu de `CampaignCharacterDao.ts` par :
```ts
import { eq, and, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import {
  campaignCharacters,
  characterSheets,
  campaigns,
  users,
} from "@infrastructure/persistence/drizzle/schema";
import { CharacterSheetSummaryRow } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";

/** Ligne brute d'une campagne rattachée à une fiche, enrichie du pseudo du MJ. */
export interface SheetCampaignViewRow {
  campaign_id: string;
  campaign_name: string;
  game_master_pseudo: string;
}

/**
 * DAO de la table de liaison `campaign_characters` : query builder Drizzle.
 *
 * Gère le rattachement N-N campagnes↔fiches. `findSheetsByCampaignId` joint vers
 * `character_sheets` (projection résumé) ; `findCampaignViewsBySheetId` joint vers
 * `campaigns` et `users` pour exposer le pseudo du MJ.
 */
export class CampaignCharacterDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    campaign_id: string;
    character_sheet_id: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(campaignCharacters).values(row);
  }

  public async delete(campaignId: string, characterSheetId: string): Promise<void> {
    await this.executor
      .delete(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaign_id, campaignId),
          eq(campaignCharacters.character_sheet_id, characterSheetId),
        ),
      );
  }

  public async existsByCampaignAndSheet(
    campaignId: string,
    characterSheetId: string,
  ): Promise<boolean> {
    const rows = await this.executor
      .select({ one: campaignCharacters.campaign_id })
      .from(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaign_id, campaignId),
          eq(campaignCharacters.character_sheet_id, characterSheetId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  public async findSheetsByCampaignId(campaignId: string): Promise<CharacterSheetSummaryRow[]> {
    return this.executor
      .select({
        id: characterSheets.id,
        owner_id: characterSheets.owner_id,
        name: characterSheets.name,
        created_at: characterSheets.created_at,
      })
      .from(characterSheets)
      .innerJoin(campaignCharacters, eq(campaignCharacters.character_sheet_id, characterSheets.id))
      .where(eq(campaignCharacters.campaign_id, campaignId))
      .orderBy(desc(campaignCharacters.created_at));
  }

  public async findCampaignViewsBySheetId(
    characterSheetId: string,
  ): Promise<SheetCampaignViewRow[]> {
    return this.executor
      .select({
        campaign_id: campaigns.id,
        campaign_name: campaigns.name,
        game_master_pseudo: users.pseudo,
      })
      .from(campaigns)
      .innerJoin(campaignCharacters, eq(campaignCharacters.campaign_id, campaigns.id))
      .innerJoin(users, eq(users.id, campaigns.game_master_id))
      .where(eq(campaignCharacters.character_sheet_id, characterSheetId))
      .orderBy(desc(campaignCharacters.created_at));
  }
}
```

> Note : `CharacterSheetSummaryRow` est exporté par `CharacterSheetDao` (Task 3.1). Le type `SheetCampaignViewRow` était auparavant interne et marqué `RowDataPacket` ; on l'exporte désormais comme interface simple (le mapper le consomme via les mêmes clés snake_case). Vérifier que le mapper/repo l'importe bien depuis ce DAO (adapter l'import si le nom de fichier source change).

- [ ] **Step 2: Vérifier le repo/mapper consommateur**

Lire `src/infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCampaignCharacterRepository.ts` et le mapper associé. Confirmer qu'ils consomment `row.campaign_id`/`row.campaign_name`/`row.game_master_pseudo` et les `CharacterSheetSummaryRow` (clés `id/owner_id/name/created_at`) — inchangées. Adapter uniquement les imports de types si nécessaire.

- [ ] **Step 3: Écrire le test db dédié**

Créer `tests/db/CampaignCharacterDao.test.ts` :
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CampaignCharacterDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CampaignCharacterDao;
  const t = new Date("2026-01-01T10:00:00Z");

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CampaignCharacterDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1", "MaitreDuJeu");
    await insertUser(pool, "owner-1");
    await pool.execute(
      "INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?,?,?,?)",
      ["camp-1", "mj-1", "Donjon", t],
    );
    await pool.execute(
      "INSERT INTO character_sheets (id, owner_id, name, created_at) VALUES (?,?,?,?)",
      ["s-1", "owner-1", "Aragorn", t],
    );
  });

  it("insère un lien, le détecte, puis le supprime", async () => {
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);
    await dao.delete("camp-1", "s-1");
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("rejette un doublon (PK composite)", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    await expect(
      dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t }),
    ).rejects.toThrow();
  });

  it("liste les fiches d'une campagne (résumé)", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    const sheets = await dao.findSheetsByCampaignId("camp-1");
    expect(sheets.map((s) => s.id)).toEqual(["s-1"]);
    expect(sheets[0]?.name).toBe("Aragorn");
  });

  it("liste les campagnes d'une fiche avec le pseudo du MJ", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    const views = await dao.findCampaignViewsBySheetId("s-1");
    expect(views).toHaveLength(1);
    expect(views[0]?.campaign_id).toBe("camp-1");
    expect(views[0]?.campaign_name).toBe("Donjon");
    expect(views[0]?.game_master_pseudo).toBe("MaitreDuJeu");
  });
});
```

- [ ] **Step 4: Lancer les tests (Docker requis)**

Run: `npx vitest run --config vitest.config.db.ts tests/db/CampaignCharacterDao.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao.ts tests/db/CampaignCharacterDao.test.ts
git commit -m "refactor(drizzle): rewrite CampaignCharacterDao with query builder"
```

---

### Task 3.3 : Re-signer createCharacterSheetRepositories

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories.ts`

- [ ] **Step 1: Changer le type du paramètre**

Remplacer l'import `SqlExecutor` par `DrizzleExecutor` et la signature `executor: SqlExecutor` par `executor: DrizzleExecutor`.

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories.ts
git commit -m "refactor(drizzle): wire character-sheet repositories on DrizzleExecutor"
```

---

## ÉTAPE 4 — UnitOfWork + composition root

### Task 4.1 : MysqlUnitOfWork → db.transaction()

**Files:**
- Modify: `src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts`

- [ ] **Step 1: Réécrire le UnitOfWork**

Remplacer le contenu par :
```ts
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { createCampaignRepositories } from "@infrastructure/persistence/mysql/features/campaign/createCampaignRepositories";
import { createCharacterSheetRepositories } from "@infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories";
import { UnitOfWork, TransactionalRepositories } from "@application/shared/UnitOfWork";

/**
 * Implémentation du `UnitOfWork` basée sur les transactions Drizzle.
 *
 * `db.transaction(cb)` ouvre une transaction, fournit un exécuteur transactionnel `tx`,
 * commit si `cb` réussit et rollback s'il lève. La règle « toute écriture passe par le UoW »
 * est préservée : les repos construits ici sont liés à `tx`.
 */
export class MysqlUnitOfWork implements UnitOfWork {
  constructor(private readonly connection: MysqlConnection) {}

  public async execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.connection.getDb().transaction(async (tx) => {
      const repos: TransactionalRepositories = {
        ...createAuthRepositories(tx),
        ...createCampaignRepositories(tx),
        ...createCharacterSheetRepositories(tx),
      };
      return work(repos);
    });
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (`tx` est compatible `DrizzleExecutor`).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts
git commit -m "refactor(drizzle): implement UnitOfWork with drizzle transactions"
```

---

### Task 4.2 : Adapter le composition root (main.ts)

**Files:**
- Modify: `src/main.ts`

`buildServices` appelle aujourd'hui `createXxxRepositories(connection.getPool())`. Les fonctions attendent désormais un `DrizzleExecutor` → passer `connection.getDb()`.

- [ ] **Step 1: Remplacer les appels**

Dans `src/main.ts`, dans `buildServices`, remplacer les trois appels `createAuthRepositories(connection.getPool())`, `createCampaignRepositories(connection.getPool())`, `createCharacterSheetRepositories(connection.getPool())` par leur variante `connection.getDb()`. Exemple :
```ts
  const {
    users: userRepository,
    credentials: credentialRepository,
    refreshTokens: refreshTokenRepository,
  } = createAuthRepositories(connection.getDb());

  const { campaigns: campaignRepository } = createCampaignRepositories(connection.getDb());

  const {
    characterSheets: characterSheetRepository,
    campaignCharacters: campaignCharacterRepository,
  } = createCharacterSheetRepositories(connection.getDb());
```

- [ ] **Step 2: Vérifier la compilation et le build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Lancer toute la suite (intégration HTTP = garde-fou)**

Run: `npm test`
Expected: PASS — les tests d'intégration HTTP (inchangés) valident le refacto bout-en-bout.

Run (Docker requis): `npm run test:db`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor(drizzle): wire composition root on drizzle instance"
```

---

## ÉTAPE 5 — Nettoyage & documentation

### Task 5.1 : Supprimer SqlExecutor et l'ancien système de migrations

**Files:**
- Delete: `src/infrastructure/persistence/mysql/SqlExecutor.ts`
- Delete: `db/migrations/*.sql`, `db/umzug.ts`, `db/migrationRunner.ts`
- Modify: `package.json` (retirer scripts Umzug + dep `umzug`)
- Modify: `tests/db/schemaEquivalence.test.ts` (supprimer — sa référence .sql disparaît)

- [ ] **Step 1: Vérifier qu'aucun code ne référence plus SqlExecutor ni migrationRunner**

Run: `grep -rn "SqlExecutor\|migrationRunner\|umzug\|runMigrations" src tests db --include=*.ts`
Expected: aucune occurrence hors des fichiers à supprimer. Si une occurrence subsiste (autre que dans les fichiers supprimés), la corriger d'abord.

- [ ] **Step 2: Supprimer les fichiers**

Run:
```bash
rm src/infrastructure/persistence/mysql/SqlExecutor.ts
rm db/umzug.ts db/migrationRunner.ts
rm db/migrations/V00*.sql
rm tests/db/schemaEquivalence.test.ts
```

- [ ] **Step 3: Nettoyer package.json**

Retirer les scripts `migrate:up`, `migrate:down`, `migrate:status` (qui pointaient vers `db/umzug.ts`). Conserver `serve` mais remplacer `npm run migrate:up` par `npm run db:migrate` dans la commande `serve`. Retirer la dépendance `umzug` :
```bash
npm uninstall umzug
```

- [ ] **Step 4: Vérifier build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: PASS.

Run (Docker requis): `npm run test:db`
Expected: PASS (le test d'équivalence n'existe plus ; les autres passent).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(drizzle): remove SqlExecutor, umzug and historical sql migrations"
```

---

### Task 5.2 : Mettre à jour la documentation des migrations

**Files:**
- Modify: `db/MIGRATION.md`
- Modify: `README.md` (section migrations/DB si présente)
- Modify: `.env.example` (si une variable a changé — vérifier ; a priori inchangé)

- [ ] **Step 1: Réécrire `db/MIGRATION.md`**

Documenter le nouveau workflow Drizzle :
- Schema = source de vérité : `src/infrastructure/persistence/drizzle/schema/*.schema.ts`
- Migration auto : modifier le schema → `npm run db:generate` → `npm run db:migrate`
- Migration custom (transformations de données, backfill, rename avec recopie) : `npm run db:custom -- --name=<desc>` → écrire le SQL à la main dans le fichier généré → `npm run db:migrate`
- Tracking : table `__drizzle_migrations`. Forward-only.
- Interdiction : ne jamais éditer `migrations/meta/` à la main.
- Bases existantes (baseline) : insérer la ligne de tracking de la baseline `0000` dans `__drizzle_migrations` pour marquer le schéma comme déjà en place (script/procédure documentée), afin de ne pas re-jouer le CREATE TABLE.

- [ ] **Step 2: Mettre à jour le README**

Mettre à jour toute mention de `npm run migrate:*` ou d'Umzug vers les commandes `db:generate`/`db:migrate`.

- [ ] **Step 3: Vérifier format**

Run: `npm run format:check`
Expected: PASS (ou lancer `npm run format` puis re-vérifier).

- [ ] **Step 4: Commit**

```bash
git add db/MIGRATION.md README.md .env.example
git commit -m "docs(drizzle): document generate/custom migration workflow"
```

---

### Task 5.3 : Vérification finale complète + push

- [ ] **Step 1: Suite complète**

Run: `npm run build && npm run lint && npm test && npm run format:check`
Expected: tout PASS.

Run (Docker requis): `npm run test:db`
Expected: PASS.

- [ ] **Step 2: Vérifier l'état git**

Run: `git status && git log --oneline main..refactor/drizzle`
Expected: working tree clean, historique de commits atomiques cohérent.

- [ ] **Step 3: Push**

```bash
git push -u origin refactor/drizzle
```

- [ ] **Step 4: Note mémoire projet**

Écrire une note mémoire (fichier sous `memory/`) résumant : refacto Drizzle (query builder + drizzle-kit), `mysql/` et classes `Mysql*` conservés, mysql2 = driver sous Drizzle, baseline non destructive, workflow generate/custom, option 3 (repenser DAO/Mapper) reportée. Ajouter la ligne d'index dans `MEMORY.md`.

---

## Self-Review (rempli par l'auteur du plan)

**Couverture spec :**
- Périmètre query builder + migrations → Étapes 0–5 ✅
- mysql2 conservé comme driver → Task 0.7 (MysqlConnection) ✅
- Noms Mysql* conservés → dossier `mysql/` gardé dans toutes les tâches ✅
- Schema par feature, types exacts, datetime mode date → Tasks 0.2–0.4 ✅
- Baseline non destructive → Task 0.5 + doc Task 5.2 ✅
- Test d'équivalence one-shot → Task 0.6, retiré Task 5.1 ✅
- Workflow generate + custom → Tasks 0.1 (scripts), 5.2 (doc) ✅
- Suppression anciens .sql + Umzug → Task 5.1 ✅
- Tests db réécrits → Tasks 1.1–3.2 ✅
- Tests intégration HTTP inchangés (garde-fou) → Task 4.2 step 3 ✅
- Séquencement feature par feature → Étapes 1/2/3 ✅
- UnitOfWork → db.transaction() → Task 4.1 ✅
- Note mémoire → Task 5.3 step 4 ✅

**Cohérence des types :** `DrizzleExecutor` défini Task 0.7, utilisé Tasks 1.x/2.x/3.x/4.x. `UserRow`/`CredentialRow`/`RefreshTokenRow`/`CampaignRow`/`CharacterSheetRow` = `$inferSelect` du schema correspondant. `CharacterSheetWriteRow` = `$inferInsert`. Colonnes snake_case cohérentes schema ↔ mappers.

**Placeholders :** aucun. Toutes les tâches contiennent le code complet, y compris Task 3.2 (CampaignCharacterDao) avec ses 5 méthodes et son test. Les rares « lire le fichier consommateur avant d'adapter les imports » (Task 3.1 step 2, Task 3.2 step 2) sont des vérifications ciblées, pas des TODO de contenu manquant.
