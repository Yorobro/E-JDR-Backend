import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import mysql from "mysql2/promise";
import type { TestProject } from "vitest/node";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolve } from "node:path";

/**
 * Setup global des tests d'intégration DB : démarre un conteneur MySQL jetable,
 * applique les migrations réelles (Umzug), puis expose les paramètres de connexion
 * aux suites de test via `provide`/`inject`.
 */

/** Paramètres de connexion exposés aux tests via `inject("db")`. */
export interface DbConnectionInfo {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    db: DbConnectionInfo;
  }
}

/** Mot de passe root du conteneur (jetable, valeur sans enjeu de sécurité). */
const ROOT_PASSWORD = "test";
/** Nom du schéma : identique à la prod car `V001` référence `e_jdr` en dur. */
const DATABASE = "e_jdr";

let container: StartedMySqlContainer;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  container = await new MySqlContainer("mysql:8.4")
    .withDatabase(DATABASE)
    .withRootPassword(ROOT_PASSWORD)
    .start();

  const info: DbConnectionInfo = {
    host: container.getHost(),
    port: container.getPort(),
    // root : V001 exécute `CREATE SCHEMA IF NOT EXISTS`, qui exige ce privilège.
    user: "root",
    password: ROOT_PASSWORD,
    database: DATABASE,
  };

  const pool = mysql.createPool({ ...info, multipleStatements: true });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(
        __dirname,
        "../../src/infrastructure/persistence/drizzle/migrations",
      ),
    });
  } catch (error) {
    // Échec de migration : sans teardown retourné à Vitest, le conteneur fuirait.
    await container.stop().catch(() => {});
    throw error;
  } finally {
    await pool.end().catch(() => {});
  }

  project.provide("db", info);

  return async () => {
    await container.stop();
  };
}
