import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";

/**
 * Représentation **brute** d'une ligne de la table `campaigns`, telle que renvoyée par MySQL.
 *
 * Le mapping vers l'entité domaine est effectué par le `CampaignMapper`, pas par le DAO.
 */
export interface CampaignRow extends RowDataPacket {
  /** Identifiant (colonne `id`). */
  id: string;
  /** Identifiant du MJ propriétaire (colonne `game_master_id`). */
  game_master_id: string;
  /** Nom de la campagne (colonne `name`). */
  name: string;
  /** Date de création (colonne `created_at`). */
  created_at: Date;
}

/**
 * DAO de la table `campaigns` : **SQL pur**, une seule table, renvoie des lignes brutes.
 *
 * Le DAO ne connaît rien du domaine ni du mapping : il exécute des requêtes sur sa table et
 * retourne les `CampaignRow` correspondantes.
 */
export class CampaignDao {
  constructor(private readonly executor: SqlExecutor) {}

  /**
   * Insère une nouvelle ligne dans la table `campaigns`.
   *
   * @param row - Les valeurs de colonnes à insérer.
   * @returns Une promesse résolue une fois l'insertion effectuée.
   */
  public async insert(row: {
    id: string;
    game_master_id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.execute(
      "INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?, ?, ?, ?)",
      [row.id, row.game_master_id, row.name, row.created_at],
    );
  }

  /**
   * Récupère toutes les lignes `campaigns` d'un maître du jeu, des plus récentes aux plus anciennes.
   *
   * @param gameMasterId - L'identifiant du MJ propriétaire.
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findByGameMasterId(gameMasterId: string): Promise<CampaignRow[]> {
    const [rows] = await this.executor.execute<CampaignRow[]>(
      "SELECT id, game_master_id, name, created_at FROM campaigns WHERE game_master_id = ? ORDER BY created_at DESC",
      [gameMasterId],
    );
    return rows;
  }

  /**
   * Récupère une ligne `campaigns` par son identifiant.
   *
   * @param id - L'identifiant recherché.
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findById(id: string): Promise<CampaignRow | null> {
    const [rows] = await this.executor.execute<CampaignRow[]>(
      "SELECT id, game_master_id, name, created_at FROM campaigns WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Supprime une ligne `campaigns` par son identifiant.
   *
   * @param id - L'identifiant de la ligne à supprimer.
   */
  public async deleteById(id: string): Promise<void> {
    await this.executor.execute("DELETE FROM campaigns WHERE id = ?", [id]);
  }
}
