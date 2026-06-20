import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionDate } from "@domain/features/session/value-objects/SessionDate";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { UpdateSessionCommand } from "@application/features/session/commands/UpdateSessionCommand";
import { UpdateSessionUseCase } from "@application/features/session/abstractions/usecases/UpdateSessionUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Use case de mise à jour d'une session.
 *
 * Charge la session, remonte à la campagne parente, vérifie que le demandeur est **éditeur**
 * du groupe (`requireEditor`), valide les nouveaux titre/date via le domaine, puis persiste
 * via le `UnitOfWork`.
 */
export class UpdateSessionUseCaseImpl implements UpdateSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(command: UpdateSessionCommand): Promise<Result<SessionView, AppError>> {
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
    if (access.isFailure) return Result.failure(access.error);

    let title: SessionTitle;
    let date: SessionDate;
    try {
      title = SessionTitle.create(command.title);
      date = SessionDate.create(command.date);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    const updated = session.withDetails({ title, date: date.value });

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.update(updated);
    });

    this.logger.info("Session mise à jour", {
      sessionId: updated.id,
      campaignId: updated.campaignId,
    });

    return Result.success({
      id: updated.id,
      campaignId: updated.campaignId,
      title: updated.title.value,
      date: SessionDate.fromDate(updated.date).toIsoDate(),
      createdAt: updated.createdAt,
    });
  }
}
