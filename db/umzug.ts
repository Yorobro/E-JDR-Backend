import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql, { Pool } from "mysql2/promise";
import { Umzug } from "umzug";
import { AppConfig, loadConfig } from "@config/env";

/**
 * Runner de migrations façon Flyway, basé sur **Umzug** + **mysql2**.
 *
 * - Les migrations sont des fichiers `.sql` versionnés (`V001__...sql`) dans `db/migrations`.
 * - Elles sont appliquées dans l'ordre alphabétique (donc numérique grâce au préfixe `Vxxx`).
 * - Une table `schema_migrations` trace les migrations déjà appliquées (idempotence).
 *
 * Usage : `ts-node db/umzug.ts <up|down|status>`.
 */

/** Répertoire contenant les fichiers de migration SQL. */
const MIGRATIONS_DIR = resolve(__dirname, "migrations");

/** Nom de la table de suivi des migrations appliquées. */
const MIGRATIONS_TABLE = "schema_migrations";

/**
 * Crée le schéma MySQL s'il n'existe pas encore.
 *
 * Se connecte sans base sélectionnée via un pool bootstrap, exécute
 * `CREATE DATABASE IF NOT EXISTS`, puis ferme ce pool temporaire.
 *
 * @param config - Configuration applicative.
 */
async function ensureSchema(config: AppConfig): Promise<void> {
  const { database } = config.db;
  if (!database) {
    throw new Error(
      "DB_NAME manquant : définissez la variable d'environnement DB_NAME pour que le schéma puisse être créé.",
    );
  }

  const bootstrap = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrap.end();
  }
}

/**
 * Crée le pool de connexions MySQL à partir de la configuration d'environnement.
 *
 * @param config - Configuration applicative.
 * @returns Un pool `mysql2/promise` prêt à l'emploi.
 */
function createPool(config: AppConfig): Pool {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });
}

/**
 * Garantit l'existence de la table de suivi des migrations.
 *
 * @param pool - Le pool de connexions MySQL.
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
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
function buildUmzug(pool: Pool): Umzug<Pool> {
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
 * Point d'entrée du script : exécute la commande passée en argument.
 *
 * @returns Une promesse résolue une fois la commande exécutée.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? "up";
  const config = loadConfig();

  await ensureSchema(config);

  const pool = createPool(config);

  try {
    await ensureMigrationsTable(pool);
    const umzug = buildUmzug(pool);

    switch (command) {
      case "up":
        await umzug.up();
        break;
      case "down":
        await umzug.down();
        break;
      case "status": {
        const pending = await umzug.pending();
        const executed = await umzug.executed();
        console.log(
          "Migrations appliquées :",
          executed.map((m) => m.name),
        );
        console.log(
          "Migrations en attente :",
          pending.map((m) => m.name),
        );
        break;
      }
      default:
        throw new Error(`Commande de migration inconnue : ${command}`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Échec des migrations :", error);
  process.exit(1);
});


