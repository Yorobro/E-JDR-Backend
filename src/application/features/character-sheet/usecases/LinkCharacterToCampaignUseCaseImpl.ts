import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { LinkCharacterToCampaignCommand } from "@application/features/character-sheet/commands/LinkCharacterToCampaignCommand";
import { LinkCharacterToCampaignUseCase } from "@application/features/character-sheet/abstractions/usecases/LinkCharacterToCampaignUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";
import { SheetAlreadyInCampaignError } from "@application/features/character-sheet/errors/SheetAlreadyInCampaignError";

/**
 * Use case de rattachement d'une fiche à une campagne.
 *
 * Porte les règles métier du rattachement (orchestration de plusieurs repos en lecture, écriture
 * de la liaison via le `UnitOfWork`) :
 * 1. la campagne et la fiche doivent exister ;
 * 2. le demandeur doit être le **propriétaire** de la fiche rattachée ;
 * 3. **le maître du jeu ne peut pas rattacher une de ses fiches à sa propre campagne** ;
 * 4. la fiche ne doit pas être déjà rattachée à cette campagne.
 */
export class LinkCharacterToCampaignUseCaseImpl implements LinkCharacterToCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly campaignCharacterRepository: CampaignCharacterRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: LinkCharacterToCampaignCommand): Promise<Result<void, AppError>> {
    const campaign = await this.campaignRepository.findById(command.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const sheet = await this.characterSheetRepository.findById(command.characterSheetId);
    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    // On ne rattache que SES propres fiches.
    if (!sheet.isOwnedBy(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    // Règle métier : le MJ ne peut pas être joueur de sa propre campagne.
    if (campaign.isGameMaster(sheet.ownerId)) {
      return Result.failure(new GameMasterCannotJoinOwnCampaignError());
    }

    // Anti-doublon (la PK composite garantit aussi l'unicité côté BDD).
    const alreadyLinked = await this.campaignCharacterRepository.existsByCampaignAndSheet(
      campaign.id,
      sheet.id,
    );
    if (alreadyLinked) {
      return Result.failure(new SheetAlreadyInCampaignError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.campaignCharacters.link(campaign.id, sheet.id, new Date());
    });

    this.logger.info("Fiche rattachée à une campagne", {
      campaignId: campaign.id,
      characterSheetId: sheet.id,
    });

    return Result.success(undefined);
  }
}
