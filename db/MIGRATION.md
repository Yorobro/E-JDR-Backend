# Conventions de migration — E-JDR Backend

Les migrations sont gérées par **Drizzle** (`drizzle-kit`). Les fichiers SQL vivent dans
`src/infrastructure/persistence/drizzle/migrations/`, et les snapshots de schéma dans le
sous-dossier `meta/`.

## Stratégie générale

- **Schema TypeScript = source unique de vérité.** Le schéma des tables est décrit en TS
  dans `src/infrastructure/persistence/drizzle/schema/*.schema.ts` (`auth`, `campaign`,
  `character-sheet`) agrégés par `schema/index.ts`. On modifie **toujours le schema TS
  d'abord**, jamais la base directement.
- **Forward-only** : pas de rollback automatique. Une migration appliquée est définitive.
  Pour défaire un changement, on écrit une **nouvelle** migration correctrice (voir plus bas).
- **Table de suivi** : Drizzle enregistre chaque migration appliquée dans
  `__drizzle_migrations` (gérée automatiquement, ne pas y toucher à la main sauf procédure
  baseline ci-dessous). Une migration déjà enregistrée **n'est jamais rejouée**.
- En cas d'échec partiel : corriger le problème, puis relancer `npm run db:migrate`. Drizzle
  reprend à la première migration non encore enregistrée.

## Workflow standard (génération automatique)

Pour la grande majorité des changements de structure (ajout de table, de colonne, d'index,
de contrainte, changement de type…) :

1. **Modifier le schema TS** dans `schema/*.schema.ts`.
2. **Générer la migration** :
   ```bash
   npm run db:generate
   ```
   Drizzle compare le schema TS au dernier snapshot de `meta/` et écrit :
   - un nouveau fichier `NNNN_<nom>.sql` (le diff DDL) dans `migrations/` ;
   - un nouveau snapshot dans `migrations/meta/`.
3. **Relire le `.sql` généré.** C'est une étape obligatoire : vérifier le DDL produit, et le
   corriger à la main si nécessaire (Drizzle ne devine pas tout — voir custom ci-dessous).
   Un fichier généré reste un fichier SQL ordinaire que l'on peut éditer **tant qu'il n'a pas
   été appliqué**.
4. **Appliquer** :
   ```bash
   npm run db:migrate
   ```
   Drizzle applique tous les `.sql` non encore tracés dans `__drizzle_migrations`, dans
   l'ordre, et enregistre chacun.

## Workflow custom (contrôle total, façon Flyway)

Pour tout ce que `db:generate` ne sait pas produire correctement — **transformations de
données, backfill, renommage avec recopie, split/merge de colonnes ou de tables, DDL non
géré automatiquement** — on génère un fichier **vide** que l'on écrit entièrement à la main :

```bash
npm run db:custom -- --name=backfill_pseudo
```

Cela crée un `NNNN_backfill_pseudo.sql` **vide** dans `migrations/` (et met à jour le
journal de `meta/`). On y écrit le SQL exact, puis on applique avec `npm run db:migrate`.

### Exemple — backfill d'une nouvelle colonne

Scénario : on vient d'ajouter `users.pseudo` (via le schema TS + `db:generate`), mais les
lignes existantes l'ont à `NULL` / vide. On écrit une migration custom pour la remplir :

```bash
npm run db:custom -- --name=backfill_users_pseudo
```

Puis dans le `.sql` généré :

```sql
-- Remplit le pseudo des comptes existants à partir de l'e-mail (partie avant le @)
UPDATE users u
JOIN credentials c ON c.user_id = u.id
SET u.pseudo = SUBSTRING_INDEX(c.email, '@', 1)
WHERE u.pseudo IS NULL OR u.pseudo = '';
```

On enchaîne ensuite avec `npm run db:migrate`. Le même mécanisme sert à défaire un
changement de schéma : on écrit une migration correctrice (par exemple un `ALTER TABLE … DROP
COLUMN`) plutôt que de tenter un rollback.

## Renommage de colonne ou de table

Quand un renommage est ambigu (Drizzle ne peut pas distinguer un `RENAME` d'un
`DROP` + `CREATE`), `npm run db:generate` pose une **question interactive** : choisir entre
**renommer** (conserve les données) et **drop + create** (perd les données). Répondre avec
soin. En cas de doute, préférer le workflow custom et écrire le `RENAME` à la main.

## Règle d'or — ne jamais éditer `migrations/meta/`

Le dossier `migrations/meta/` (snapshots + `_journal.json`) est **généré et consommé par
drizzle-kit** pour calculer les diffs entre deux `db:generate`. L'éditer à la main désynchronise
le calcul de diff et corrompt les générations suivantes. On modifie le **schema TS**, jamais
les snapshots.

## Bases existantes — baseline

La migration baseline `0000_*.sql` contient le `CREATE TABLE` des **6 tables** (`users`,
`credentials`, `refresh_tokens`, `campaigns`, `character_sheets`, `campaign_characters`).

- **Base neuve** (CI Testcontainers, nouvel environnement de dev) : `npm run db:migrate`
  applique tout depuis zéro — la baseline crée les tables, puis les migrations suivantes
  s'appliquent dans l'ordre.
- **Base déjà au schéma** (environnement dont les tables existent déjà, p. ex. créées par un
  outil de migration antérieur) : il ne faut **pas** rejouer la baseline, sinon les
  `CREATE TABLE` échouent. On marque la baseline comme **déjà appliquée** en insérant sa ligne
  de tracking dans `__drizzle_migrations`, **sans** exécuter son DDL :

  ```sql
  -- Marque la baseline 0000 comme déjà appliquée, sans recréer les tables.
  -- Crée la table de suivi si elle n'existe pas (Drizzle, dialecte MySQL).
  CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
    `id`         SERIAL PRIMARY KEY,
    `hash`       TEXT NOT NULL,
    `created_at` BIGINT
  );

  -- `hash` = SHA-256 du contenu du fichier 0000_*.sql ;
  -- `created_at` = champ `when` de l'entrée correspondante dans meta/_journal.json.
  INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  VALUES ('<sha256-du-0000_*.sql>', <when-du-journal>);
  ```

  Une fois cette ligne posée, `npm run db:migrate` ignore la baseline et n'applique que les
  migrations **postérieures**. Sur une base neuve, cette étape est inutile.

## Reset complet — `db:reset` (DESTRUCTIF)

Quand les données d'une base **sont jetables** (dev, ou prod en phase early sans données à
préserver) et qu'on veut une base **100 % Drizzle sans résidu** d'un ancien outil de migration,
le plus simple est la table rase :

```bash
npm run db:reset
```

Ce script (`db/reset.ts`) cible la base de `.env` (`DB_*`) et :

1. supprime **toutes** les tables de la base (données comprises), y compris une éventuelle table
   de suivi héritée (`schema_migrations`) ;
2. réapplique les migrations Drizzle depuis zéro via le migrator (la baseline recrée les 6
   tables, puis les migrations suivantes s'appliquent), ce qui initialise `__drizzle_migrations`.

Résultat : une base propre, suivie uniquement par Drizzle.

### ⚠️ Procédure PROD

`db:reset` **détruit toutes les données**. En prod, ne l'utiliser **que** si les données sont
réellement jetables (décision explicite). Procédure :

1. **Confirmer** que la prod n'a pas de données à préserver.
2. Pointer la connexion vers la prod en fournissant ses variables d'environnement au script,
   par exemple :
   ```bash
   DB_HOST=<prod-host> DB_PORT=<port> DB_USER=<user> DB_PASSWORD=<pwd> DB_NAME=<db> \
     npm run db:reset
   ```
   (ou en s'appuyant sur le `.env`/secret manager de l'environnement de prod).
3. Déployer le code de la branche, puis démarrer normalement (`npm run serve`, qui enchaîne
   `db:migrate` — désormais idempotent puisque la baseline est tracée).

Si un jour la prod contient des données **à préserver**, ne pas utiliser `db:reset` : utiliser
l'adoption non destructive de la section « Bases existantes — baseline » ci-dessus.

## Commandes utiles

| Commande | Description |
|---|---|
| `npm run db:generate` | Génère une migration SQL à partir du schema Drizzle modifié (+ snapshot dans `meta/`). |
| `npm run db:migrate` | Applique les migrations Drizzle en attente et les trace dans `__drizzle_migrations`. |
| `npm run db:custom -- --name=<desc>` | Crée une migration SQL **vide** à écrire à la main (transformations de données, backfill, renommage avec recopie). |
| `npm run db:reset` | **DESTRUCTIF.** Drop toutes les tables de la base puis réapplique les migrations Drizzle depuis zéro (base jetable / passage 100 % Drizzle). |
| `npm run test:db` | Rejoue toutes les migrations sur une base vierge via le migrator Drizzle (Testcontainers, Docker requis). |

## Checklist avant de merger une migration

- [ ] Le **schema TS** (`schema/*.schema.ts`) reflète l'état cible.
- [ ] La migration a été **générée** (`db:generate`) ou écrite à la main (`db:custom`), et son
      `.sql` a été **relu**.
- [ ] Aucune édition manuelle de `migrations/meta/`.
- [ ] Pour une transformation de données : migration **custom** dédiée, pas un `db:generate`
      détourné.
- [ ] Testée localement (`npm run db:migrate` sur une base de dev).
- [ ] Validée par `npm run test:db` (les tests Testcontainers rejouent depuis zéro).
