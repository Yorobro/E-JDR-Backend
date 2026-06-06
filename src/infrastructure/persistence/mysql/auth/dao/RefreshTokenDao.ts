import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Représentation **brute** d'une ligne de la table `refresh_tokens`.
 *
 * Les noms de colonnes (snake_case) reflètent exactement le schéma SQL.
 */
export interface RefreshTokenRow extends RowDataPacket {
  /** Identifiant de la ligne (colonne `id`). */
  id: string;
  /** Identifiant de l'utilisateur propriétaire (colonne `user_id`). */
  user_id: string;
  /** Empreinte du refresh token (colonne `token_hash`). */
  token_hash: string;
  /** Date d'expiration (colonne `expires_at`). */
  expires_at: Date;
  /** Date de création (colonne `created_at`). */
  created_at: Date;
}

/**
 * DAO de la table `refresh_tokens` : **SQL pur**, une seule table, renvoie des lignes brutes.
 *
 * Comme tout DAO, il ignore le domaine et le mapping : il exécute des requêtes sur sa table
 * et retourne des `RefreshTokenRow`.
 */
export class RefreshTokenDao {
  /**
   * @param pool - Le pool de connexions MySQL.
   */
  constructor(private readonly pool: Pool) {}

  /**
   * Insère une nouvelle ligne de refresh token.
   *
   * @param row - Les valeurs de colonnes à insérer.
   * @returns Une promesse résolue une fois l'insertion effectuée.
   */
  public async insert(row: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.token_hash, row.expires_at, row.created_at],
    );
  }

  /**
   * Récupère une ligne de refresh token par son empreinte.
   *
   * @param tokenHash - L'empreinte recherchée.
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const [rows] = await this.pool.execute<RefreshTokenRow[]>(
      `SELECT id, user_id, token_hash, expires_at, created_at
       FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  /**
   * Supprime une ligne de refresh token par son empreinte.
   *
   * @param tokenHash - L'empreinte du token à supprimer.
   * @returns Une promesse résolue une fois la suppression effectuée.
   */
  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.execute("DELETE FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
  }

  /**
   * Supprime toutes les lignes de refresh token d'un utilisateur.
   *
   * @param userId - L'identifiant de l'utilisateur concerné.
   * @returns Une promesse résolue une fois les suppressions effectuées.
   */
  public async deleteAllForUser(userId: string): Promise<void> {
    await this.pool.execute("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
  }
}
