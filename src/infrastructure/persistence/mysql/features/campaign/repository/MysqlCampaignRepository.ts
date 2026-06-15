import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { CampaignMapper } from "@infrastructure/persistence/mysql/features/campaign/mappers/CampaignMapper";

/**
 * Implémentation MySQL du port `CampaignRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `CampaignDao`, puis traduit les lignes brutes en
 * entités domaine via le `CampaignMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlCampaignRepository implements CampaignRepository {
  /**
   * @param campaignDao - DAO de la table `campaigns` (SQL pur).
   */
  constructor(private readonly campaignDao: CampaignDao) {}

  /**
   * @inheritdoc
   */
  public async save(campaign: Campaign): Promise<void> {
    await this.campaignDao.insert(CampaignMapper.toRow(campaign));
  }

  /**
   * @inheritdoc
   */
  public async findByGameMasterId(gameMasterId: string): Promise<Campaign[]> {
    const rows = await this.campaignDao.findByGameMasterId(gameMasterId);
    return rows.map((row) => CampaignMapper.toDomain(row));
  }

  /**
   * @inheritdoc
   */
  public async findById(id: string): Promise<Campaign | null> {
    const row = await this.campaignDao.findById(id);
    return row === null ? null : CampaignMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async deleteById(id: string): Promise<void> {
    await this.campaignDao.deleteById(id);
  }
}
