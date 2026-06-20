import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CreateCampaignCommand } from "@application/features/campaign/commands/CreateCampaignCommand";
import {
  CreateCampaignUseCase,
  CreateCampaignResult,
} from "@application/features/campaign/abstractions/usecases/CreateCampaignUseCase";

export class CreateCampaignUseCaseImpl implements CreateCampaignUseCase {
  constructor(
    private readonly idGenerator: IdGeneratorService,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: CreateCampaignCommand,
  ): Promise<Result<CreateCampaignResult, AppError>> {
    const accessResult = await this.groupAccessService.requireEditor(
      command.gameMasterId,
      command.groupId,
    );
    if (accessResult.isFailure) return Result.failure(accessResult.error);

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
      groupId: command.groupId,
      gameMasterId: command.gameMasterId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.campaigns.save(campaign);
    });

    this.logger.info("Campagne créée", {
      campaignId: campaign.id,
      groupId: campaign.groupId,
      gameMasterId: campaign.gameMasterId,
    });

    return Result.success({
      id: campaign.id,
      name: campaign.name.value,
      createdAt: campaign.createdAt,
    });
  }
}
