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
 * Vide toutes les tables métier via DELETE (TRUNCATE échouerait sur les FK), enfants d'abord.
 *
 * @param pool - Le pool de test.
 */
export async function clearAllTables(pool: Pool): Promise<void> {
  // Ordre FK : enfants d'abord.
  // sheet_* cascadent depuis character_sheets, mais on les supprime explicitement pour clarté.
  await pool.execute("DELETE FROM sheet_armes");
  await pool.execute("DELETE FROM sheet_armures");
  await pool.execute("DELETE FROM sheet_competences");
  await pool.execute("DELETE FROM sheet_equipements");
  // peuple_stat_bonuses cascade depuis peoples (lui-même cascadé par friend_groups), mais on le
  // supprime explicitement : un test qui seede des bonus sans groupe resterait sinon sale.
  await pool.execute("DELETE FROM peuple_stat_bonuses");
  // character_sheets référence campaigns (FK campaign_id) : à supprimer AVANT campaigns.
  await pool.execute("DELETE FROM character_sheets");
  await pool.execute("DELETE FROM refresh_tokens");
  await pool.execute("DELETE FROM credentials");
  await pool.execute("DELETE FROM campaigns");
  // friend_groups doit être supprimé après campaigns (FK RESTRICT sur campaigns.group_id).
  // Sa suppression cascade vers group_members, group_invitations et les tables de référence.
  await pool.execute("DELETE FROM friend_groups");
  await pool.execute("DELETE FROM users");
}

/**
 * Insère un groupe d'amis minimal (satisfait les FK de `campaigns` et des tables de référence).
 *
 * @param pool - Le pool de test.
 * @param id - L'identifiant du groupe.
 * @param createdById - L'identifiant de l'utilisateur créateur (doit exister dans `users`).
 * @param name - Le nom du groupe (par défaut dérivé de l'id).
 */
export async function insertFriendGroup(
  pool: Pool,
  id: string,
  createdById: string,
  name = `groupe-${id}`,
): Promise<void> {
  await pool.execute(
    "INSERT INTO friend_groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)",
    [id, name, createdById, new Date("2026-01-01T10:00:00Z")],
  );
}

/**
 * Insère un utilisateur minimal (satisfait les FK de `credentials`/`refresh_tokens`).
 *
 * @param pool - Le pool de test.
 * @param id - L'identifiant de l'utilisateur.
 * @param pseudo - Le pseudo (par défaut dérivé de l'id).
 */
export async function insertUser(pool: Pool, id: string, pseudo = `pseudo-${id}`): Promise<void> {
  await pool.execute("INSERT INTO users (id, pseudo, created_at) VALUES (?, ?, ?)", [
    id,
    pseudo,
    new Date("2026-01-01T10:00:00Z"),
  ]);
}

/**
 * Insère une campagne minimale (satisfait la FK `character_sheets.campaign_id`).
 *
 * @param pool - Le pool de test.
 * @param id - L'identifiant de la campagne.
 * @param groupId - L'identifiant du groupe parent (doit exister dans `friend_groups`).
 * @param gameMasterId - L'identifiant du MJ (doit exister dans `users`).
 * @param name - Le nom de la campagne (par défaut dérivé de l'id).
 */
export async function insertCampaign(
  pool: Pool,
  id: string,
  groupId: string,
  gameMasterId: string,
  name = `campagne-${id}`,
): Promise<void> {
  await pool.execute(
    "INSERT INTO campaigns (id, group_id, game_master_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, groupId, gameMasterId, name, new Date("2026-01-01T10:00:00Z")],
  );
}
