import { SessionDate } from "@domain/features/session/value-objects/SessionDate";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { ListCampaignSessionsQuery } from "@application/features/session/query/ListCampaignSessionsQuery";
import { ListCampaignSessionsUseCase } from "@application/features/session/abstractions/usecases/ListCampaignSessionsUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Use case « lister les sessions d'une campagne ».
 *
 * Vérifie d'abord que la campagne existe et que le demandeur est **membre** du groupe
 * (`requireMember`), puis interroge le repository des sessions (lecture, hors `UnitOfWork`)
 * et projette en DTO de lecture.
 */
export class ListCampaignSessionsUseCaseImpl implements ListCampaignSessionsUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(query: ListCampaignSessionsQuery): Promise<Result<SessionView[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const access = await this.groupAccessService.requireMember(query.actorUserId, campaign.groupId);
    if (access.isFailure) return Result.failure(access.error);

    const sessions = await this.sessionRepository.findByCampaignId(campaign.id);

    const views: SessionView[] = sessions.map((session) => ({
      id: session.id,
      campaignId: session.campaignId,
      title: session.title.value,
      date: SessionDate.fromDate(session.date).toIsoDate(),
      status: session.status.value,
      createdAt: session.createdAt,
    }));

    return Result.success(views);
  }
}
