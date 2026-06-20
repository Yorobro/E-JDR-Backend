import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { DeleteSessionCommand } from "@application/features/session/commands/DeleteSessionCommand";
import { DeleteSessionUseCase } from "@application/features/session/abstractions/usecases/DeleteSessionUseCase";

/**
 * Use case de suppression d'une session.
 *
 * Charge la session, remonte à la campagne parente, vérifie que le demandeur est **éditeur**
 * du groupe (`requireEditor`), puis supprime via le `UnitOfWork`.
 * L'autorisation découle du rôle dans le groupe de la campagne parente.
 */
export class DeleteSessionUseCaseImpl implements DeleteSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(command: DeleteSessionCommand): Promise<Result<void, AppError>> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const access = await this.groupAccessService.requireEditor(
      command.actorUserId,
      campaign.groupId,
    );
    if (access.isFailure) {
      this.logger.warn("Tentative de suppression d'une session sans droits d'édition", {
        sessionId: command.sessionId,
        actorUserId: command.actorUserId,
      });
      return Result.failure(access.error);
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.deleteById(session.id);
    });

    this.logger.info("Session supprimée", {
      sessionId: session.id,
      campaignId: session.campaignId,
    });

    return Result.success(undefined);
  }
}
