import { Session } from "@domain/features/session/entities/Session";
import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionDate } from "@domain/features/session/value-objects/SessionDate";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import { CreateSessionCommand } from "@application/features/session/commands/CreateSessionCommand";
import { CreateSessionUseCase } from "@application/features/session/abstractions/usecases/CreateSessionUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Use case de création d'une session dans une campagne.
 *
 * Orchestration pure : vérifie que la campagne existe et que le demandeur en est le **maître
 * du jeu** (`campaign.isGameMaster`), valide le titre et la date via le domaine, crée l'entité
 * `Session` puis la persiste via le `UnitOfWork`. La validation métier vit dans le domaine.
 *
 * Règle d'autorisation : seul le MJ de la campagne (son créateur) gère ses sessions ; le rôle
 * dans le groupe d'amis ne confère aucun droit d'écriture sur une campagne dont on n'est pas MJ.
 */
export class CreateSessionUseCaseImpl implements CreateSessionUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly idGenerator: IdGeneratorService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: CreateSessionCommand): Promise<Result<SessionView, AppError>> {
    const campaign = await this.campaignRepository.findById(command.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    if (!campaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new CampaignAccessDeniedError());
    }

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

    const session = Session.create({
      id: this.idGenerator.generate(),
      campaignId: campaign.id,
      title,
      date: date.value,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.save(session);
    });

    this.logger.info("Session créée", { sessionId: session.id, campaignId: campaign.id });

    return Result.success({
      id: session.id,
      campaignId: session.campaignId,
      title: session.title.value,
      date: SessionDate.fromDate(session.date).toIsoDate(),
      createdAt: session.createdAt,
    });
  }
}
