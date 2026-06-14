import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { CharacterSheetMapper } from "@infrastructure/persistence/mysql/features/character-sheet/mappers/CharacterSheetMapper";

/**
 * Implémentation MySQL du port `CampaignCharacterRepository` (liaison N-N).
 *
 * Assemble le `CampaignCharacterDao` (SQL pur) ; réutilise le `CharacterSheetMapper` pour
 * traduire les lignes jointes en entités domaine.
 */
export class MysqlCampaignCharacterRepository implements CampaignCharacterRepository {
  constructor(private readonly campaignCharacterDao: CampaignCharacterDao) {}

  public async link(campaignId: string, characterSheetId: string, createdAt: Date): Promise<void> {
    await this.campaignCharacterDao.insert({
      campaign_id: campaignId,
      character_sheet_id: characterSheetId,
      created_at: createdAt,
    });
  }

  public async unlink(campaignId: string, characterSheetId: string): Promise<void> {
    await this.campaignCharacterDao.delete(campaignId, characterSheetId);
  }

  public async existsByCampaignAndSheet(
    campaignId: string,
    characterSheetId: string,
  ): Promise<boolean> {
    return this.campaignCharacterDao.existsByCampaignAndSheet(campaignId, characterSheetId);
  }

  public async findSheetsByCampaignId(campaignId: string): Promise<CharacterSheet[]> {
    const rows = await this.campaignCharacterDao.findSheetsByCampaignId(campaignId);
    return rows.map((row) => CharacterSheetMapper.toDomain(row));
  }

  public async findCampaignViewsBySheetId(
    characterSheetId: string,
  ): Promise<SheetCampaignView[]> {
    const rows = await this.campaignCharacterDao.findCampaignViewsBySheetId(characterSheetId);
    return rows.map((row) => ({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      gameMasterPseudo: row.game_master_pseudo,
    }));
  }
}
