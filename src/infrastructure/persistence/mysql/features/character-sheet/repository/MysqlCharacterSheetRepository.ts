import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";
import { CharacterSheetDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { CharacterSheetMapper } from "@infrastructure/persistence/mysql/features/character-sheet/mappers/CharacterSheetMapper";

/**
 * Implémentation MySQL du port `CharacterSheetRepository`.
 *
 * Assemble le `CharacterSheetDao` (SQL pur) et le `CharacterSheetMapper` (row ↔ domaine).
 */
export class MysqlCharacterSheetRepository implements CharacterSheetRepository {
  constructor(private readonly characterSheetDao: CharacterSheetDao) {}

  public async save(sheet: CharacterSheet): Promise<void> {
    await this.characterSheetDao.insert(CharacterSheetMapper.toRow(sheet));
  }

  public async update(sheet: CharacterSheet): Promise<void> {
    await this.characterSheetDao.update(CharacterSheetMapper.toRow(sheet));
  }

  public async findByOwnerId(ownerId: string): Promise<CharacterSheet[]> {
    const rows = await this.characterSheetDao.findByOwnerId(ownerId);
    return rows.map((row) => CharacterSheetMapper.toDomain(row));
  }

  public async findByGroupId(groupId: string): Promise<CharacterSheet[]> {
    const rows = await this.characterSheetDao.findByGroupId(groupId);
    return rows.map((row) => CharacterSheetMapper.toDomain(row));
  }

  public async findById(id: string): Promise<CharacterSheet | null> {
    const row = await this.characterSheetDao.findById(id);
    return row === null ? null : CharacterSheetMapper.toDomain(row);
  }

  public async deleteById(id: string): Promise<void> {
    await this.characterSheetDao.deleteById(id);
  }

  public async findByCampaignIdAndStatus(
    campaignId: string,
    status: string,
  ): Promise<CharacterSheet[]> {
    const rows = await this.characterSheetDao.findByCampaignIdAndStatus(campaignId, status);
    return rows.map((row) => CharacterSheetMapper.toDomain(row));
  }

  public async updateLinkStatus(id: string, status: string): Promise<void> {
    await this.characterSheetDao.updateLinkStatus(id, status);
  }

  public async findCampaignViewBySheetId(sheetId: string): Promise<SheetCampaignView | null> {
    const row = await this.characterSheetDao.findCampaignViewBySheetId(sheetId);
    if (row === null) {
      return null;
    }
    return {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      gameMasterPseudo: row.game_master_pseudo,
      linkStatus: row.link_status,
    };
  }
}
