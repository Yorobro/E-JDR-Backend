# Refacto Drizzle — Design

**Date** : 2026-06-15
**Branche** : `refactor/drizzle`
**Statut** : design validé, prêt pour plan d'implémentation

## Objectif

Remplacer la couche d'accès aux données actuelle (SQL brut via `mysql2` + runner de
migrations Umzug façon Flyway) par **Drizzle ORM** :

- **query builder typé** Drizzle à la place du SQL brut dans les DAOs ;
- **migrations drizzle-kit** (`generate` + `--custom`) à la place d'Umzug et des fichiers
  `Vxxx__*.sql`.

Le SGBD reste **MySQL**. C'est uniquement la *façon* d'y accéder qui change.

## Principe directeur

Drizzle est un **détail d'infrastructure** confiné derrière les ports
`@application/**/abstractions/repositories/*`. Le domaine, l'application, les controllers
et les routes ne changent **pas**. La frontière hexagonale est préservée à l'identique.

Le pattern existant **DAO (accès table) → Mapper (Row ↔ domaine) → Repository (port)** est
**conservé**. Seule l'implémentation interne des DAOs change (query builder au lieu de SQL
brut). Repenser ce pattern (fusion DAO+Mapper, repos parlant directement à Drizzle) est une
évolution **reportée** (hors périmètre de ce refacto).

## Décisions

| Sujet | Décision |
|---|---|
| Périmètre | Query builder + migrations drizzle-kit. Pattern DAO/Mapper/Repo préservé. |
| Driver | `mysql2` **conservé** comme driver bas niveau sous `drizzle-orm/mysql2`. |
| Nommage | Dossier `mysql/` et classes `Mysql*` **gardés** (le SGBD reste MySQL). Ajout de `DrizzleExecutor` + `drizzle/schema/`. |
| Schema | Défini en TS, par feature, reflétant exactement l'état post-V007. `datetime` en mode `date`. |
| Baseline | Non destructive : tracking manuel sur bases existantes, recréation depuis zéro sur bases neuves. |
| Workflow migrations | `generate` (diff auto) + `generate --custom` (SQL écrit à la main, contrôle Flyway). |
| Anciens `.sql` + Umzug | **Supprimés** une fois la baseline validée (historique conservé dans git). |
| Tests db | **Réécrits** pour Drizzle. |
| Tests intégration HTTP | **Inchangés** — garde-fou de non-régression bout-en-bout. |
| Séquencement | Feature par feature, vert à chaque palier. |

## Pourquoi `mysql2` reste nécessaire

Drizzle n'est pas un driver : c'est une couche au-dessus d'un driver.

```
code → Drizzle (query builder typé) → mysql2 (protocole MySQL, pool) → MySQL
```

Drizzle construit le SQL et mappe les résultats, mais ne sait pas parler le protocole binaire
MySQL ni gérer un pool. C'est le rôle de `mysql2`, **peer dependency obligatoire** de
`drizzle-orm/mysql2` (cf. doc officielle). Après refacto, l'usage de `mysql2` est **réduit** à
son seul vrai rôle : création du pool dans `MysqlConnection`, passé une fois à `drizzle()`.
Plus aucun `RowDataPacket` ni SQL brut dans les DAOs.

## Architecture cible

### Connecteur Drizzle

- `MysqlConnection` garde la création du pool `mysql2`, et expose en plus une instance
  `db = drizzle(pool, { schema })`.
- Nouveau type partagé `DrizzleExecutor = MySql2Database<typeof schema>`, défini dans
  `drizzle/DrizzleExecutor.ts` (artefact purement Drizzle). Il couvre **à la fois** `db` (hors
  transaction) et `tx` (dans une transaction Drizzle), exactement le double rôle que
  `SqlExecutor` jouait pour `Pool`/`PoolConnection`. Le mécanisme du UnitOfWork est donc
  préservé.
- `SqlExecutor` (`Pick<Pool,"execute"|"query">`) est retiré au profit de `DrizzleExecutor`.

### Schema Drizzle (source unique de vérité)

Emplacement : `src/infrastructure/persistence/drizzle/schema/`

- `auth.schema.ts` → `users`, `credentials`, `refresh_tokens`
- `campaign.schema.ts` → `campaigns`
- `character-sheet.schema.ts` → `character_sheets`, `campaign_characters`
- `index.ts` → ré-exporte tout (objet `schema` passé à `drizzle()`)

Mapping de types (état post-V007, au type près pour éviter une migration parasite) :

| SQL actuel | Drizzle (`mysql-core`) |
|---|---|
| `CHAR(36)` (ids, FK) | `char(name, { length: 36 })` |
| `CHAR(64)` (token_hash) | `char(name, { length: 64 })` |
| `VARCHAR(n)` | `varchar(name, { length: n })` |
| `INT NULL` | `int(name)` (nullable par défaut) |
| `TEXT NULL` | `text(name)` |
| `DATETIME NOT NULL` | `datetime(name, { mode: "date" }).notNull()` |
| `PRIMARY KEY (a,b)` composite | `primaryKey({ columns: [...] })` |
| `FK ... ON DELETE CASCADE` | `.references(() => parent.id, { onDelete: "cascade" })` |
| `UNIQUE KEY` / `KEY` | `unique()` / `index()` |

`datetime` en **mode `date`** est essentiel : les mappers continuent de recevoir des `Date`,
donc restent inchangés.

### DAOs

Le type injecté passe de `SqlExecutor` à `DrizzleExecutor`. Les types `XxxRow` n'`extends`
plus `RowDataPacket` : ils deviennent les types **inférés** de Drizzle
(`typeof table.$inferSelect`), avec projections explicites pour les listes (« nom seul »).

Exemple (`CampaignDao.findById`) :

```ts
// AVANT
const [rows] = await this.executor.execute<CampaignRow[]>(
  "SELECT id, game_master_id, name, created_at FROM campaigns WHERE id = ? LIMIT 1", [id]);
return rows[0] ?? null;

// APRÈS
const rows = await this.executor
  .select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
return rows[0] ?? null;
```

Cas particuliers :

- **`CharacterSheetDao`** : la machinerie SQL dynamique (`ALL_COLUMNS`, `DETAIL_COLUMNS`,
  `valuesOf`, placeholders) est **supprimée** au profit de `.insert(...).values(row)` /
  `.update(...).set(...)` typés. Projections de liste explicites.
- **`findLinkableForCampaign`** : la sous-requête corrélée `NOT EXISTS` devient
  `notExists(executor.select().from(campaignCharacters).where(...))`. Équivalence vérifiée par
  un test db dédié.

### UnitOfWork

```ts
public async execute<T>(work): Promise<T> {
  return this.db.transaction(async (tx) => {
    const repos = {
      ...createAuthRepositories(tx),
      ...createCampaignRepositories(tx),
      ...createCharacterSheetRepositories(tx),
    };
    return work(repos);
  });
}
```

Drizzle gère commit/rollback/release automatiquement (rollback si le callback `throw`). La
règle d'archi « toute écriture passe par le UoW » est préservée. Les `createXxxRepositories`
changent juste de signature (`DrizzleExecutor` au lieu de `SqlExecutor`/`Pool`).

### Ce qui ne change PAS

Ports d'application, use cases, entités domaine, value objects, mappers (sauf imports de
types Row), controllers, routes, tests unitaires domaine/application, tests d'intégration HTTP.

## Migrations Drizzle

Workflow `generate + migrate` :

1. Modifier le schema TS (source de vérité).
2. `drizzle-kit generate` → fichier SQL de diff dans
   `src/infrastructure/persistence/drizzle/migrations/` + snapshot dans `meta/`.
3. `drizzle-kit migrate` applique les `.sql` non encore appliqués, tracés dans
   `__drizzle_migrations`. Forward-only (comme l'existant).

**Contrôle Flyway préservé** : `drizzle-kit generate --custom --name=<x>` crée un fichier
`.sql` **vide** où l'on écrit le SQL exact à la main (transformations de données, backfills,
renommages avec recopie, split/merge de tables). Les fichiers générés peuvent aussi être
édités avant application. Les renommages ambigus déclenchent un prompt (rename vs drop+create).

**Discipline** : ne jamais éditer `meta/` à la main (snapshots utilisés pour les diffs).

Comparaison avec le Flyway actuel — Drizzle est un sur-ensemble :

| | Flyway-actuel (Umzug) | Drizzle |
|---|---|---|
| SQL versionné, ordonné | ✅ | ✅ |
| SQL écrit à la main | ✅ toujours | ✅ via `--custom` ou édition du généré |
| SQL généré automatiquement | ❌ | ✅ en option |
| Tracking | `schema_migrations` | `__drizzle_migrations` |
| Forward-only | ✅ | ✅ |
| Schema TS typé synchronisé | ❌ | ✅ |

## Stratégie baseline (non destructive)

1. Écrire le schema TS complet (post-V007).
2. `drizzle-kit generate` → migration baseline `0000_*.sql` (CREATE TABLE des 6 tables).
   Ne jamais l'appliquer sur une base déjà migrée.
3. **Bases existantes** (dev local, coéquipiers) : insérer manuellement la ligne de tracking
   dans `__drizzle_migrations` pour marquer la baseline comme déjà appliquée. Drizzle ne
   recrée pas les tables. → script one-shot fourni + documenté.
4. **Bases neuves** (CI Testcontainers, nouveau dev) : `drizzle-kit migrate` applique la
   baseline depuis zéro → schéma identique.
5. La table `schema_migrations` (Umzug) reste sur les bases existantes mais n'est plus lue.

## Tests & validation

Trois niveaux :

1. **Tests d'intégration HTTP** (`*.integration.test.ts`) — **inchangés**, garde-fou principal
   de non-régression bout-en-bout (Express → use cases → repos → MySQL Testcontainers).
2. **Tests db** (`tests/db/*`) — **réécrits** pour cibler les DAOs Drizzle, même contrat de
   comportement (insert/find/update/delete, cas limites, rejets FK), contre un vrai MySQL
   Testcontainers.
3. **Tests unitaires** domaine/application — **inchangés** (fakes en mémoire).

**Test d'équivalence de schéma (one-shot, critique)** : garde-fou de la baseline.

- Base A : MySQL vierge migrée par les anciens `.sql` (V001→V007 via `runMigrations` Umzug).
- Base B : MySQL vierge migrée par la baseline Drizzle.
- Comparer le `SHOW CREATE TABLE` normalisé des 6 tables (types, nullabilité, FK cascade,
  index, unique, PK composites). Doivent être équivalents.

Tant que ce test n'est pas vert, on ne supprime pas les anciens `.sql`. Il est **retiré**
après le refacto (les `.sql` de référence disparaissant).

**Infra de test** : `tests/db/dbTestUtils.ts` et `tests/presentation/buildTestApp.ts`
remplacent `runMigrations(pool)` Umzug par le migrator Drizzle, et exposent une instance `db`
Drizzle là où un pool/executor était attendu. Fait une fois (partagé).

**Commandes de vérification à chaque palier** : `npm run build`, `npm run lint`, `npm test`,
`npm run test:db` (nécessite Docker), `npm run format:check`.

> Note : `test:db` exige Docker actif. Si Docker est indisponible pendant le refacto, ces
> tests sont lancés manuellement par le développeur.

## Séquencement

- **Étape 0 — Socle** : ajout `drizzle-orm` + `drizzle-kit`, `drizzle.config.ts`, schema TS
  complet, baseline `0000`, test d'équivalence de schéma (doit être vert avant la suite),
  `DrizzleExecutor` + `drizzle()` dans `MysqlConnection`, adaptation infra de test.
- **Étape 1 — Auth** : DAOs `User`/`Credential`/`RefreshToken` → Drizzle,
  `createAuthRepositories` re-signé, tests db auth réécrits.
- **Étape 2 — Campaign** : `CampaignDao` → Drizzle, tests réécrits.
- **Étape 3 — Character-sheet** : `CharacterSheetDao` + `CampaignCharacterDao` → Drizzle
  (`findLinkableForCampaign`, projections, insert/update complet), tests réécrits.
- **Étape 4 — UnitOfWork** : `MysqlUnitOfWork` → `db.transaction()`.
- **Étape 5 — Nettoyage & doc** : retrait d'Umzug, **suppression** des anciens `.sql` +
  `umzug.ts` + `migrationRunner.ts`, retrait du test d'équivalence, mise à jour
  `db/MIGRATION.md` (deux workflows : `generate` / `--custom`) + README, note mémoire projet.

Chaque étape : commit(s) atomique(s), conventional commits (`refactor:`, `test:`, `build:`,
`chore:`). Vert exigé à chaque palier.

## Organisation des fichiers cible

```
src/infrastructure/persistence/
  mysql/
    MysqlConnection.ts          (pool mysql2 + instance drizzle)
    MysqlUnitOfWork.ts          (db.transaction())
    features/auth|campaign|character-sheet/
      {dao,mappers,repository,create*Repositories.ts}
  drizzle/
    DrizzleExecutor.ts          (type partagé db/tx)
    schema/                     auth.schema.ts, campaign.schema.ts, character-sheet.schema.ts, index.ts
    migrations/                 0000_baseline.sql, meta/...   (généré par drizzle-kit)
drizzle.config.ts               (racine — schema + migrations + creds depuis l'env)
```

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Schema Drizzle divergent de l'état réel post-V007 | Test d'équivalence de schéma one-shot avant tout. Mapping de types documenté. |
| `findLinkableForCampaign` (NOT EXISTS) mal traduit | Test db dédié comparant le comportement. |
| Bases existantes des coéquipiers cassées par la baseline | Baseline non destructive + script de tracking one-shot documenté. |
| Réécriture des tests db = perte partielle du filet | Tests d'intégration HTTP inchangés comme référence de non-régression. |
| Régression de typage (`Date` vs string sur datetime) | `datetime` en mode `date`, mappers inchangés. |
| Docker indisponible pour `test:db` | Signalé ; exécution manuelle par le développeur. |

## Hors périmètre (reporté)

- Repenser le pattern DAO/Mapper/Repository (option 3 : fusion DAO+Mapper, repos parlant
  directement à Drizzle). Évolution intéressante, à traiter dans un refacto ultérieur.
- Changement de driver (PlanetScale, TiDB...) : orthogonal, sans intérêt ici.
