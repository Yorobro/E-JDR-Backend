import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { DeleteCampaignCommand } from "@application/features/campaign/commands/DeleteCampaignCommand";
import { DeleteCampaignUseCase } from "@application/features/campaign/abstractions/usecases/DeleteCampaignUseCase";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";

/**
 * Use case de suppression d'une campagne.
 *
 * Orchestration pure : charge la campagne, vérifie via le domaine que le demandeur en est le
 * **maître du jeu** (`campaign.isGameMaster`) **et** qu'il est toujours membre du groupe de la
 * campagne (cohérent avec la création, qui exige le membership). L'autorisation est exprimée
 * par l'entité + le service d'accès groupe ; le use case ne fait qu'orchestrer et traduire les
 * refus en erreurs métier.
 */
export class DeleteCampaignUseCaseImpl implements DeleteCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: DeleteCampaignCommand): Promise<Result<void, AppError>> {
    const campaign = await this.campaignRepository.findById(command.campaignId);

    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    if (!campaign.isGameMaster(command.gameMasterId)) {
      this.logger.warn("Tentative de suppression d'une campagne par un non-propriétaire", {
        campaignId: command.campaignId,
        gameMasterId: command.gameMasterId,
      });
      return Result.failure(new CampaignAccessDeniedError());
    }

    // Le MJ doit toujours appartenir au groupe de la campagne (D2/D5 : cohérence avec la création).
    const memberAccess = await this.groupAccessService.requireMember(
      command.gameMasterId,
      campaign.groupId,
    );
    if (memberAccess.isFailure) {
      return Result.failure(memberAccess.error);
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.campaigns.deleteById(campaign.id);
    });

    this.logger.info("Campagne supprimée", {
      campaignId: campaign.id,
      gameMasterId: campaign.gameMasterId,
    });

    return Result.success(undefined);
  }
}
