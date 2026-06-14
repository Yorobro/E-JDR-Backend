import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";

/**
 * Représentation **brute** d'une ligne de la table `character_sheets`, telle que renvoyée
 * par MySQL. Le mapping vers l'entité domaine est effectué par le `CharacterSheetMapper`.
 */
export interface CharacterSheetRow extends RowDataPacket {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
}

/**
 * DAO de la table `character_sheets` : **SQL pur**, une seule table, renvoie des lignes brutes.
 */
export class CharacterSheetDao {
  constructor(private readonly executor: SqlExecutor) {}

  /**
   * Insère une nouvelle ligne dans la table `character_sheets`.
   *
   * @param row - Les valeurs de colonnes à insérer.
   */
  public async insert(row: {
    id: string;
    owner_id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.execute(
      "INSERT INTO character_sheets (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)",
      [row.id, row.owner_id, row.name, row.created_at],
    );
  }

  /**
   * Récupère toutes les fiches d'un propriétaire, des plus récentes aux plus anciennes.
   *
   * @param ownerId - L'identifiant du propriétaire.
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findByOwnerId(ownerId: string): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      "SELECT id, owner_id, name, created_at FROM character_sheets WHERE owner_id = ? ORDER BY created_at DESC",
      [ownerId],
    );
    return rows;
  }

  /**
   * Récupère une ligne `character_sheets` par son identifiant.
   *
   * @param id - L'identifiant recherché.
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findById(id: string): Promise<CharacterSheetRow | null> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      "SELECT id, owner_id, name, created_at FROM character_sheets WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Supprime une ligne `character_sheets` par son identifiant.
   *
   * @param id - L'identifiant de la ligne à supprimer.
   */
  public async deleteById(id: string): Promise<void> {
    await this.executor.execute("DELETE FROM character_sheets WHERE id = ?", [id]);
  }

  /**
   * Récupère les fiches rattachables à une campagne : propriétaire ≠ MJ, hors fiches déjà
   * liées à cette campagne. Triées des plus récentes aux plus anciennes.
   *
   * @param gameMasterId - L'identifiant du MJ (ses fiches sont exclues).
   * @param campaignId - L'identifiant de la campagne (les fiches déjà liées sont exclues).
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      `SELECT cs.id, cs.owner_id, cs.name, cs.created_at
         FROM character_sheets cs
        WHERE cs.owner_id <> ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_characters cc
             WHERE cc.character_sheet_id = cs.id AND cc.campaign_id = ?
          )
        ORDER BY cs.created_at DESC`,
      [gameMasterId, campaignId],
    );
    return rows;
  }
}
