import mysql, { Pool } from "mysql2/promise";
import { inject } from "vitest";

/**
 * Utilitaires partagés des suites de tests DB : connexion au conteneur démarré
 * par `globalSetup.ts` et remise à zéro des tables entre les tests.
 */

/**
 * Crée un pool connecté au MySQL de test (paramètres injectés par le setup global).
 *
 * @returns Un pool `mysql2/promise` à fermer en `afterAll`.
 */
export function createTestPool(): Pool {
  const db = inject("db");
  return mysql.createPool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
  });
}

/**
 * Vide toutes les tables métier, enfants d'abord (contraintes FK).
 *
 * @param pool - Le pool de test.
 */
export async function truncateAllTables(pool: Pool): Promise<void> {
  await pool.execute("DELETE FROM refresh_tokens");
  await pool.execute("DELETE FROM credentials");
  await pool.execute("DELETE FROM users");
}

/**
 * Insère un utilisateur minimal (satisfait les FK de `credentials`/`refresh_tokens`).
 *
 * @param pool - Le pool de test.
 * @param id - L'identifiant de l'utilisateur.
 */
export async function insertUser(pool: Pool, id: string): Promise<void> {
  await pool.execute("INSERT INTO users (id, created_at) VALUES (?, ?)", [
    id,
    new Date("2026-01-01T10:00:00Z"),
  ]);
}
