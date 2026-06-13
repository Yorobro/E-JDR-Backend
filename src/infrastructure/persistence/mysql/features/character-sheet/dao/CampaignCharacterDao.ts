import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";
import { CharacterSheetRow } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";

/** Ligne brute du COUNT d'existence d'un lien. */
interface CountRow extends RowDataPacket {
  count: number;
}

/**
 * DAO de la table de liaison `campaign_characters` : **SQL pur**.
 *
 * Gère le rattachement N-N campagnes↔fiches. La méthode {@link findSheetsByCampaignId} joint
 * vers `character_sheets` et renvoie des `CharacterSheetRow` (mappées ensuite vers le domaine).
 */
export class CampaignCharacterDao {
  constructor(private readonly executor: SqlExecutor) {}

  /**
   * Insère un lien campagne↔fiche.
   *
   * @param row - Les colonnes du lien.
   */
  public async insert(row: {
    campaign_id: string;
    character_sheet_id: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.execute(
      "INSERT INTO campaign_characters (campaign_id, character_sheet_id, created_at) VALUES (?, ?, ?)",
      [row.campaign_id, row.character_sheet_id, row.created_at],
    );
  }

  /**
   * Supprime un lien campagne↔fiche (aucune erreur si absent).
   *
   * @param campaignId - Identifiant de la campagne.
   * @param characterSheetId - Identifiant de la fiche.
   */
  public async delete(campaignId: string, characterSheetId: string): Promise<void> {
    await this.executor.execute(
      "DELETE FROM campaign_characters WHERE campaign_id = ? AND character_sheet_id = ?",
      [campaignId, characterSheetId],
    );
  }

  /**
   * Indique si un lien campagne↔fiche existe déjà.
   *
   * @param campaignId - Identifiant de la campagne.
   * @param characterSheetId - Identifiant de la fiche.
   * @returns `true` si le lien existe.
   */
  public async existsByCampaignAndSheet(
    campaignId: string,
    characterSheetId: string,
  ): Promise<boolean> {
    const [rows] = await this.executor.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM campaign_characters WHERE campaign_id = ? AND character_sheet_id = ?",
      [campaignId, characterSheetId],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  /**
   * Récupère les fiches rattachées à une campagne (JOIN vers `character_sheets`),
   * des plus récemment rattachées aux plus anciennes.
   *
   * @param campaignId - Identifiant de la campagne.
   * @returns Les lignes `character_sheets` rattachées.
   */
  public async findSheetsByCampaignId(campaignId: string): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      `SELECT cs.id, cs.owner_id, cs.name, cs.created_at
         FROM character_sheets cs
         JOIN campaign_characters cc ON cc.character_sheet_id = cs.id
        WHERE cc.campaign_id = ?
        ORDER BY cc.created_at DESC`,
      [campaignId],
    );
    return rows;
  }
}
