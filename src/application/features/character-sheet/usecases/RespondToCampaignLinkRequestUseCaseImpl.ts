import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { RespondToCampaignLinkRequestCommand } from "@application/features/character-sheet/commands/RespondToCampaignLinkRequestCommand";
import { RespondToCampaignLinkRequestUseCase } from "@application/features/character-sheet/abstractions/usecases/RespondToCampaignLinkRequestUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case « le MJ valide ou refuse une demande de rattachement d'une fiche à sa campagne ».
 *
 * Règles :
 * 1. la campagne et la fiche doivent exister ;
 * 2. le demandeur doit être le **maître du jeu** de la campagne ;
 * 3. la fiche doit être rattachée à **cette** campagne et en statut **PENDING** ;
 * 4. **accept** → statut ACCEPTED ; **refus** → la fiche est **supprimée** (cascade sur ses liaisons).
 */
export class RespondToCampaignLinkRequestUseCaseImpl implements RespondToCampaignLinkRequestUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(
    command: RespondToCampaignLinkRequestCommand,
  ): Promise<Result<void, AppError>> {
    const campaign = await this.campaignRepository.findById(command.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    // Seul le MJ de la campagne statue sur les demandes de rattachement.
    if (!campaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const sheet = await this.characterSheetRepository.findById(command.characterSheetId);
    // La fiche doit exister, être rattachée à CETTE campagne et être encore en attente.
    if (sheet === null || sheet.campaignId !== campaign.id || !sheet.isPending()) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    if (command.accept) {
      await this.unitOfWork.execute(async (repos) => {
        await repos.characterSheets.updateLinkStatus(sheet.id, "ACCEPTED");
      });
      this.logger.info("Rattachement de fiche validé par le MJ", {
        campaignId: campaign.id,
        characterSheetId: sheet.id,
      });
    } else {
      // Refus = la fiche est supprimée (ON DELETE CASCADE retire ses lignes filles).
      await this.unitOfWork.execute(async (repos) => {
        await repos.characterSheets.deleteById(sheet.id);
      });
      this.logger.info("Rattachement de fiche refusé par le MJ (fiche supprimée)", {
        campaignId: campaign.id,
        characterSheetId: sheet.id,
      });
    }

    // Rafraîchit « Mes fiches » du propriétaire (la fiche est devenue active, ou a disparu).
    this.realtimeNotifier.notifyUserChanged(sheet.ownerId, "character-sheets");

    return Result.success(undefined);
  }
}
