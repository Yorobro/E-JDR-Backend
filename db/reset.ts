import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { loadConfig } from "@config/env";

/**
 * Reset complet de la base puis recréation du schéma via les migrations Drizzle.
 *
 * ⚠️ DESTRUCTIF : supprime TOUTES les tables de la base cible (données comprises), y compris
 * l'ancienne table de suivi Umzug `schema_migrations`. Le schéma est ensuite reconstruit
 * proprement à partir des migrations Drizzle (`__drizzle_migrations` est créée par le migrator).
 *
 * Usage : `npm run db:reset` (lit la connexion depuis `.env` via la config applicative).
 *
 * Cas d'emploi :
 *  - bases de dev jetables qu'on veut basculer en « 100 % Drizzle » sans résidu Umzug ;
 *  - prod **uniquement** si ses données sont jetables (sinon faire une adoption non destructive).
 */

/** Dossier des migrations Drizzle (SQL généré + meta). */
const MIGRATIONS_DIR = resolve(__dirname, "../src/infrastructure/persistence/drizzle/migrations");

/**
 * Supprime toutes les tables de la base sélectionnée, FK checks désactivés le temps du drop
 * (l'ordre des tables n'a alors plus d'importance).
 *
 * @param pool - Pool MySQL connecté à la base cible.
 */
async function dropAllTables(pool: mysql.Pool): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const tables = rows.map((r) => r["name"] as string);

  if (tables.length === 0) {
    console.log("Aucune table à supprimer.");
    return;
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  } finally {
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }
  console.log(`Tables supprimées (${tables.length}) : ${tables.join(", ")}`);
}

/**
 * Point d'entrée : drop total puis migration Drizzle depuis zéro.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const { database } = config.db;
  if (!database) {
    throw new Error("DB_NAME manquant : impossible de cibler une base pour le reset.");
  }

  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database,
    multipleStatements: true,
  });

  try {
    console.log(`Reset de la base « ${database} » (${config.db.host}:${config.db.port})…`);
    await dropAllTables(pool);
    console.log("Application des migrations Drizzle…");
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
    console.log("✓ Base reconstruite via Drizzle (table __drizzle_migrations initialisée).");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Échec du reset :", error);
  process.exit(1);
});
