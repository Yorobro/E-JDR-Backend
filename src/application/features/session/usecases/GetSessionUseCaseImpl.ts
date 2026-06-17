import { SessionDate } from "@domain/features/session/value-objects/SessionDate";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
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
 * Charge la session, remonte à la campagne parente et vérifie que le demandeur en est le
 * maître du jeu avant de retourner le détail. Lecture pure (hors `UnitOfWork`).
 */
export class GetSessionUseCaseImpl implements GetSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
  ) {}

  public async execute(query: GetSessionQuery): Promise<Result<SessionView, AppError>> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    // Le FK cascade garantit la présence de la campagne parente ; par prudence, une campagne
    // absente ou un demandeur non‑MJ aboutit au même refus d'accès.
    if (campaign === null || !campaign.isGameMaster(query.actorUserId)) {
      return Result.failure(new CampaignAccessDeniedError());
    }

    return Result.success({
      id: session.id,
      campaignId: session.campaignId,
      title: session.title.value,
      date: SessionDate.fromDate(session.date).toIsoDate(),
      createdAt: session.createdAt,
    });
  }
}
