import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CreateCampaignCommand } from "@application/features/campaign/commands/CreateCampaignCommand";
import {
  CreateCampaignUseCase,
  CreateCampaignResult,
} from "@application/features/campaign/abstractions/usecases/CreateCampaignUseCase";

/**
 * Use case de création d'une campagne.
 *
 * Orchestration pure : valide le nom via le domaine (value object `CampaignName`), crée
 * l'entité `Campaign` en établissant l'utilisateur courant comme maître du jeu, puis la
 * persiste via le `UnitOfWork`. La validation métier vit dans le domaine, pas ici.
 */
export class CreateCampaignUseCaseImpl implements CreateCampaignUseCase {
  constructor(
    private readonly idGenerator: IdGeneratorService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: CreateCampaignCommand,
  ): Promise<Result<CreateCampaignResult, AppError>> {
    let name: CampaignName;

    try {
      name = CampaignName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    const campaign = Campaign.create({
      id: this.idGenerator.generate(),
      gameMasterId: command.gameMasterId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.campaigns.save(campaign);
    });

    this.logger.info("Campagne créée", {
      campaignId: campaign.id,
      gameMasterId: campaign.gameMasterId,
    });

    return Result.success({
      id: campaign.id,
      name: campaign.name.value,
      createdAt: campaign.createdAt,
    });
  }
}
