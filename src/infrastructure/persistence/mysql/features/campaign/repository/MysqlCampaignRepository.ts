import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { CampaignMapper } from "@infrastructure/persistence/mysql/features/campaign/mappers/CampaignMapper";

export class MysqlCampaignRepository implements CampaignRepository {
  constructor(private readonly campaignDao: CampaignDao) {}

  public async save(campaign: Campaign): Promise<void> {
    await this.campaignDao.insert(CampaignMapper.toRow(campaign));
  }

  public async findByGroupId(groupId: string): Promise<Campaign[]> {
    const rows = await this.campaignDao.findByGroupId(groupId);
    return rows.map((row) => CampaignMapper.toDomain(row));
  }

  public async existsByGroupId(groupId: string): Promise<boolean> {
    return this.campaignDao.existsByGroupId(groupId);
  }

  public async findById(id: string): Promise<Campaign | null> {
    const row = await this.campaignDao.findById(id);
    return row === null ? null : CampaignMapper.toDomain(row);
  }

  public async deleteById(id: string): Promise<void> {
    await this.campaignDao.deleteById(id);
  }
}
