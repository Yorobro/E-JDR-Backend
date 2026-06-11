# Conventions de migration — E-JDR Backend

## Stratégie générale

- **Forward-only** : pas de rollback automatique. Une migration appliquée est définitive.
- **Table de suivi** : Umzug enregistre chaque migration appliquée dans `schema_migrations` (colonne `name`). Une migration déjà enregistrée **n'est jamais rejouée**, même si le fichier SQL est modifié après coup.
- En cas d'échec partiel : corriger le problème, puis relancer `npm run migrate:up`. Umzug reprend à la migration non encore enregistrée.

## Convention de nommage

```
Vxxx__description_snake_case.sql
```

- `xxx` : numéro à **3 chiffres**, incrémental (ex: `001`, `002`, `010`).
- `description_snake_case` : courte description en minuscules avec underscores.
- Exemples valides : `V001__create_initial_schema.sql`, `V003__add_credential_lockout.sql`.

## ⚠️ Risque de collision de numéro en équipe

Deux développeurs créant `V004` sur des branches différentes provoqueront un conflit au merge :
- Deux fichiers `V004` distincts, ou un ordre d'application ambigu.
- Umzug trie par **ordre alphabétique du nom** — un doublon de numéro entraîne un comportement imprévisible.

**Recommandation** :
1. Avant de créer une migration, annoncer le numéro choisi dans le canal d'équipe (ex: Slack/Discord).
2. Réserver le numéro tôt (créer le fichier vide sur la branche) pour bloquer les collisions.
3. En cas de conflit au merge : renuméroter la migration la plus récente et mettre à jour `schema_migrations` sur les bases locales concernées.

## Écrire des migrations idempotentes

MySQL 8.0 ne supporte **pas** `CREATE INDEX IF NOT EXISTS` ni `ADD COLUMN IF NOT EXISTS`. Utiliser le pattern `information_schema` guard :

### Modèle — ADD COLUMN

```sql
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'ma_table' AND column_name = 'ma_colonne'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE ma_table ADD COLUMN ma_colonne INT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
```

### Modèle — CREATE INDEX

```sql
SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'ma_table'
    AND index_name = 'mon_index'
);
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX mon_index ON ma_table (ma_colonne)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

> Ces patterns sont utilisés dans `V002` et `V003` comme référence.

## Commandes utiles

| Commande | Description |
|---|---|
| `npm run migrate:up` | Applique toutes les migrations en attente |
| `npm run migrate:status` | Liste les migrations appliquées / en attente |
| `npm run test:db` | Rejoue toutes les migrations sur une base vierge (Testcontainers) |

## Checklist avant de merger une migration

- [ ] Nom du fichier respecte `Vxxx__description_snake_case.sql`
- [ ] Numéro coordonné avec l'équipe (pas de doublon)
- [ ] Migration idempotente (pattern `information_schema` si ADD COLUMN / CREATE INDEX)
- [ ] Testée localement via `npm run migrate:up` sur une base de dev
- [ ] Validée par `npm run test:db` (les tests Testcontainers rejouent depuis zéro)
