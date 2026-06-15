import mysql from "mysql2/promise";
import { loadConfig } from "@config/env";
import { resolveDbName } from "./resolveDbName";

/**
 * Bootstrap de la base de données avant migrations.
 *
 * Se connecte au serveur MySQL **sans sélectionner de base**, puis crée la base applicative
 * (`e_jdr`) si elle n'existe pas encore. Idempotent : `CREATE DATABASE IF NOT EXISTS` ne fait
 * rien si la base est déjà là.
 *
 * Indispensable sur les déploiements (ex. Vertex / Cloud Run) où la base cible n'est pas
 * pré-créée : sans cette étape, `drizzle-kit migrate` échoue avec
 * `ER_BAD_DB_ERROR: Unknown database '…'`.
 *
 * Usage : `npm run db:bootstrap`, exécuté avant `db:migrate` (cf. script `serve`).
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const database = resolveDbName(config.db.database);

  // Connexion au serveur sans base sélectionnée : on doit pouvoir créer la base elle-même.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  try {
    // Le nom de base est issu d'une allow-list (resolveDbName), donc sûr à interpoler ici ;
    // MySQL n'accepte de toute façon pas de placeholder préparé pour un identifiant DDL.
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`✓ Base « ${database} » prête (${config.db.host}:${config.db.port}).`);
  } finally {
    await connection.end();
  }
}

void main().catch((error) => {
  console.error("Échec du bootstrap de la base :", error);
  process.exit(1);
});
