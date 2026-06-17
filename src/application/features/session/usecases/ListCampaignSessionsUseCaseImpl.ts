import { SessionDate } from "@domain/features/session/value-objects/SessionDate";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { ListCampaignSessionsQuery } from "@application/features/session/query/ListCampaignSessionsQuery";
import { ListCampaignSessionsUseCase } from "@application/features/session/abstractions/usecases/ListCampaignSessionsUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Use case « lister les sessions d'une campagne ».
 *
 * Vérifie d'abord que la campagne existe et que le demandeur en est le maître du jeu, puis
 * interroge le repository des sessions (lecture, hors `UnitOfWork`) et projette en DTO de lecture.
 */
export class ListCampaignSessionsUseCaseImpl implements ListCampaignSessionsUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  public async execute(query: ListCampaignSessionsQuery): Promise<Result<SessionView[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    if (!campaign.isGameMaster(query.actorUserId)) {
      return Result.failure(new CampaignAccessDeniedError());
    }

    const sessions = await this.sessionRepository.findByCampaignId(campaign.id);

    const views: SessionView[] = sessions.map((session) => ({
      id: session.id,
      campaignId: session.campaignId,
      title: session.title.value,
      date: SessionDate.fromDate(session.date).toIsoDate(),
      createdAt: session.createdAt,
    }));

    return Result.success(views);
  }
}
