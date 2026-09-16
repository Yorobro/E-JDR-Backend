import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { StartSessionCommand } from "@application/features/session/commands/StartSessionCommand";
import { StartSessionUseCase } from "@application/features/session/abstractions/usecases/StartSessionUseCase";

/**
 * Use case « le MJ démarre réellement la session ».
 *
 * Orchestration pure :
 * 1. la session doit exister et sa campagne aussi ;
 * 2. le demandeur doit être **éditeur** du groupe (`requireEditor`) — c'est le MJ ;
 * 3. la transition `LOBBY → ACTIVE` (et l'invariant « on ne démarre que depuis LOBBY ») est
 *    portée par l'entité {@link Session.start} ; l'écriture passe par le `UnitOfWork`.
 *
 * Notifie ensuite le groupe (best-effort, resource `session-status`) pour faire basculer le MJ
 * comme les joueurs présents vers l'écran de jeu en temps réel.
 */
export class StartSessionUseCaseImpl implements StartSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(command: StartSessionCommand): Promise<Result<void, AppError>> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const access = await this.groupAccessService.requireEditor(
      command.actorUserId,
      campaign.groupId,
    );
    if (access.isFailure) return Result.failure(access.error);

    // Transition métier portée par l'entité : échoue si la session n'est pas au statut LOBBY.
    let started;
    try {
      started = session.start({ startedAt: new Date() });
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.update(started);
    });

    this.logger.info("Session démarrée", {
      sessionId: session.id,
      campaignId: campaign.id,
    });

    // Fait basculer le MJ et les joueurs présents vers l'écran de jeu — best-effort.
    this.realtimeNotifier.notifyGroupChanged(campaign.groupId, "session-status");

    return Result.success(undefined);
  }
}
