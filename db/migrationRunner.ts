import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql, { Pool } from "mysql2/promise";
import { Umzug } from "umzug";

/**
 * Cœur réutilisable du runner de migrations (pattern Flyway via Umzug).
 *
 * Extrait de `db/umzug.ts` pour être utilisable hors CLI : les tests d'intégration
 * Testcontainers exécutent les **mêmes migrations** contre un MySQL jetable, ce qui
 * valide à la fois les DAO et les migrations elles-mêmes.
 */

/** Répertoire contenant les fichiers de migration SQL. */
export const MIGRATIONS_DIR = resolve(__dirname, "migrations");

/** Nom de la table de suivi des migrations appliquées. */
export const MIGRATIONS_TABLE = "schema_migrations";

/**
 * Garantit l'existence de la table de suivi des migrations.
 *
 * @param pool - Le pool de connexions MySQL.
 */
export async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       name       VARCHAR(255) NOT NULL,
       applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (name)
     ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`,
  );
}

/**
 * Construit l'instance Umzug configurée pour exécuter les migrations SQL via mysql2.
 *
 * @param pool - Le pool de connexions MySQL partagé.
 * @returns L'instance Umzug paramétrée.
 */
export function buildUmzug(pool: Pool): Umzug<Pool> {
  return new Umzug<Pool>({
    context: pool,
    logger: console,
    migrations: {
      glob: ["*.sql", { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, path }) => ({
        name,
        up: async () => {
          const sql = readFileSync(path as string, "utf8");
          await pool.query(sql);
          await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [name]);
        },
        down: async () => {
          // Stratégie assumée : migrations **forward-only**. Aucun rollback automatique
          // n'est fourni, car retirer la seule trace sans annuler le DDL laisserait la base
          // dans un état incohérent (tables présentes mais marquées « non appliquées »).
          // Pour revenir en arrière, écrire une nouvelle migration `Vxxx` correctrice.
          throw new Error(
            `Rollback non supporté : les migrations sont forward-only. ` +
              `Pour annuler « ${name} », créez une nouvelle migration correctrice.`,
          );
        },
      }),
    },
    storage: {
      /**
       * Enregistre une migration comme exécutée. L'insertion réelle est faite dans `up`
       * (au sein de la même opération), donc rien à faire ici.
       */
      logMigration: async () => {
        /* trace gérée dans la migration `up` */
      },
      /**
       * Retire la trace d'une migration. La suppression réelle est faite dans `down`.
       */
      unlogMigration: async () => {
        /* trace gérée dans la migration `down` */
      },
      /**
       * Liste les migrations déjà appliquées d'après la table de suivi.
       *
       * @returns Les noms des migrations exécutées.
       */
      executed: async () => {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`,
        );
        return rows.map((row) => row["name"] as string);
      },
    },
  });
}

/**
 * Applique toutes les migrations en attente sur le pool fourni.
 *
 * Point d'entrée programmatique (sans lecture de `.env`) utilisé par les tests
 * d'intégration Testcontainers.
 *
 * @param pool - Le pool MySQL cible (doit autoriser `multipleStatements`).
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  await buildUmzug(pool).up();
}
