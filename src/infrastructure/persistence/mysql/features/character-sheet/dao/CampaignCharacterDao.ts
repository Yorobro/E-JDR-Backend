import { eq, and, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import {
  campaignCharacters,
  characterSheets,
  campaigns,
  users,
} from "@infrastructure/persistence/drizzle/schema";
import { CharacterSheetRow } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";

/** Ligne brute d'une campagne rattachée à une fiche, enrichie du pseudo du MJ. */
export interface SheetCampaignViewRow {
  campaign_id: string;
  campaign_name: string;
  game_master_pseudo: string;
}

/**
 * DAO de la table de liaison `campaign_characters` : query builder Drizzle.
 */
export class CampaignCharacterDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    campaign_id: string;
    character_sheet_id: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(campaignCharacters).values(row);
  }

  public async delete(campaignId: string, characterSheetId: string): Promise<void> {
    await this.executor
      .delete(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaign_id, campaignId),
          eq(campaignCharacters.character_sheet_id, characterSheetId),
        ),
      );
  }

  public async existsByCampaignAndSheet(
    campaignId: string,
    characterSheetId: string,
  ): Promise<boolean> {
    const rows = await this.executor
      .select({ one: campaignCharacters.campaign_id })
      .from(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaign_id, campaignId),
          eq(campaignCharacters.character_sheet_id, characterSheetId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  public async findSheetsByCampaignId(campaignId: string): Promise<CharacterSheetRow[]> {
    return this.executor
      .select()
      .from(characterSheets)
      .innerJoin(campaignCharacters, eq(campaignCharacters.character_sheet_id, characterSheets.id))
      .where(eq(campaignCharacters.campaign_id, campaignId))
      .orderBy(desc(campaignCharacters.created_at))
      .then((rows) => rows.map((r) => r.character_sheets));
  }

  public async findCampaignViewsBySheetId(
    characterSheetId: string,
  ): Promise<SheetCampaignViewRow[]> {
    return this.executor
      .select({
        campaign_id: campaigns.id,
        campaign_name: campaigns.name,
        game_master_pseudo: users.pseudo,
      })
      .from(campaigns)
      .innerJoin(campaignCharacters, eq(campaignCharacters.campaign_id, campaigns.id))
      .innerJoin(users, eq(users.id, campaigns.game_master_id))
      .where(eq(campaignCharacters.character_sheet_id, characterSheetId))
      .orderBy(desc(campaignCharacters.created_at));
  }
}
