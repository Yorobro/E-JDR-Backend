import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { ListMyCampaignsQuery } from "@application/features/campaign/query/ListMyCampaignsQuery";
import {
  ListMyCampaignsUseCase,
  CampaignSummary,
} from "@application/features/campaign/abstractions/usecases/ListMyCampaignsUseCase";

export class ListMyCampaignsUseCaseImpl implements ListMyCampaignsUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(query: ListMyCampaignsQuery): Promise<Result<CampaignSummary[], AppError>> {
    const accessResult = await this.groupAccessService.requireMember(query.userId, query.groupId);
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const campaigns = await this.campaignRepository.findByGroupId(query.groupId);

    const summaries: CampaignSummary[] = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name.value,
      createdAt: campaign.createdAt,
    }));

    return Result.success(summaries);
  }
}
