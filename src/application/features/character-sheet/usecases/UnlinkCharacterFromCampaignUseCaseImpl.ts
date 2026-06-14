import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { UnlinkCharacterFromCampaignCommand } from "@application/features/character-sheet/commands/UnlinkCharacterFromCampaignCommand";
import { UnlinkCharacterFromCampaignUseCase } from "@application/features/character-sheet/abstractions/usecases/UnlinkCharacterFromCampaignUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case de détachement d'une fiche d'une campagne.
 *
 * Autorisation : le détachement est permis au seul maître du jeu de la campagne.
 * L'opération est idempotente (succès même si le lien est déjà absent) une fois l'autorisation
 * validée.
 */
export class UnlinkCharacterFromCampaignUseCaseImpl implements UnlinkCharacterFromCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: UnlinkCharacterFromCampaignCommand,
  ): Promise<Result<void, AppError>> {
    const campaign = await this.campaignRepository.findById(command.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const sheet = await this.characterSheetRepository.findById(command.characterSheetId);
    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    // Seul le MJ de la campagne gère la composition de sa table (rattache et détache).
    if (!campaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.campaignCharacters.unlink(campaign.id, sheet.id);
    });

    this.logger.info("Fiche détachée d'une campagne", {
      campaignId: campaign.id,
      characterSheetId: sheet.id,
    });

    return Result.success(undefined);
  }
}
