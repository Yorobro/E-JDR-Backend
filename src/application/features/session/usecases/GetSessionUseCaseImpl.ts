import { SessionDate } from "@domain/features/session/value-objects/SessionDate";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { GetSessionQuery } from "@application/features/session/query/GetSessionQuery";
import {
  GetSessionUseCase,
  SessionView,
} from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Use case « obtenir une session ».
 *
 * Charge la session, remonte à la campagne parente et vérifie que le demandeur est **membre**
 * du groupe (`requireMember`) avant de retourner le détail. Lecture pure (hors `UnitOfWork`).
 */
export class GetSessionUseCaseImpl implements GetSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(query: GetSessionQuery): Promise<Result<SessionView, AppError>> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const access = await this.groupAccessService.requireMember(query.actorUserId, campaign.groupId);
    if (access.isFailure) return Result.failure(access.error);

    return Result.success({
      id: session.id,
      campaignId: session.campaignId,
      title: session.title.value,
      date: SessionDate.fromDate(session.date).toIsoDate(),
      status: session.status.value,
      createdAt: session.createdAt,
    });
  }
}
