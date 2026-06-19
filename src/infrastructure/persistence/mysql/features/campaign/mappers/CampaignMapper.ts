import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { CampaignRow } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";

export class CampaignMapper {
  public static toDomain(row: CampaignRow): Campaign {
    return Campaign.restore({
      id: row.id,
      groupId: row.group_id,
      gameMasterId: row.game_master_id,
      name: CampaignName.create(row.name),
      createdAt: new Date(row.created_at),
    });
  }

  public static toRow(campaign: Campaign): {
    id: string;
    group_id: string;
    game_master_id: string;
    name: string;
    created_at: Date;
  } {
    return {
      id: campaign.id,
      group_id: campaign.groupId,
      game_master_id: campaign.gameMasterId,
      name: campaign.name.value,
      created_at: campaign.createdAt,
    };
  }
}
