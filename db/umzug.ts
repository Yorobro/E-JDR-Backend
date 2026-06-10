import mysql, { Pool } from "mysql2/promise";
import { AppConfig, loadConfig } from "@config/env";
import { buildUmzug, ensureMigrationsTable } from "./migrationRunner";

/**
 * Runner de migrations façon Flyway, basé sur **Umzug** + **mysql2**.
 *
 * - Les migrations sont des fichiers `.sql` versionnés (`V001__...sql`) dans `db/migrations`.
 * - Elles sont appliquées dans l'ordre alphabétique (donc numérique grâce au préfixe `Vxxx`).
 * - Une table `schema_migrations` trace les migrations déjà appliquées (idempotence).
 *
 * Usage : `ts-node db/umzug.ts <up|down|status>`.
 */

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
