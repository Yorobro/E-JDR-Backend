import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { ListMyCampaignsQuery } from "@application/features/campaign/query/ListMyCampaignsQuery";
import {
  ListMyCampaignsUseCase,
  CampaignSummary,
} from "@application/features/campaign/abstractions/usecases/ListMyCampaignsUseCase";

/**
 * Use case « lister mes campagnes ».
 *
 * Lecture pure : interroge directement le repository (pas de `UnitOfWork`) pour récupérer
 * les campagnes dont l'utilisateur est le maître du jeu, puis les projette en DTO de lecture.
 */
export class ListMyCampaignsUseCaseImpl implements ListMyCampaignsUseCase {
  constructor(private readonly campaignRepository: CampaignRepository) {}

  public async execute(query: ListMyCampaignsQuery): Promise<Result<CampaignSummary[], AppError>> {
    const campaigns = await this.campaignRepository.findByGameMasterId(query.gameMasterId);

    const summaries: CampaignSummary[] = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name.value,
      createdAt: campaign.createdAt,
    }));

    return Result.success(summaries);
  }
}
