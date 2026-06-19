import { Campaign } from "@domain/features/campaign/entities/Campaign";

export interface CampaignRepository {
  save(campaign: Campaign): Promise<void>;

  /** Liste toutes les campagnes d'un groupe (du plus récent au plus ancien). */
  findByGroupId(groupId: string): Promise<Campaign[]>;

  /** Retourne `true` si au moins une campagne appartient à ce groupe. */
  existsByGroupId(groupId: string): Promise<boolean>;

  findById(id: string): Promise<Campaign | null>;

  deleteById(id: string): Promise<void>;
}
