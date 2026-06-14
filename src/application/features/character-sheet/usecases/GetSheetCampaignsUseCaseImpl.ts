import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";
import { GetSheetCampaignsQuery } from "@application/features/character-sheet/query/GetSheetCampaignsQuery";
import {
  GetSheetCampaignsUseCase,
} from "@application/features/character-sheet/abstractions/usecases/GetSheetCampaignsUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case listant les campagnes auxquelles une fiche est rattachée (enrichies du pseudo du MJ).
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**
 * (`sheet.isOwnedBy`), puis projette les vues de campagne. Lecture pure (sans `UnitOfWork`).
 */
export class GetSheetCampaignsUseCaseImpl implements GetSheetCampaignsUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly campaignCharacterRepository: CampaignCharacterRepository,
    private readonly logger: Logger,
  ) {}

  public async execute(
    query: GetSheetCampaignsQuery,
  ): Promise<Result<SheetCampaignView[], AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    if (!sheet.isOwnedBy(query.ownerId)) {
      this.logger.warn("Tentative de consultation des campagnes d'une fiche par un non-propriétaire", {
        characterSheetId: query.characterSheetId,
        ownerId: query.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const views = await this.campaignCharacterRepository.findCampaignViewsBySheetId(
      query.characterSheetId,
    );
    return Result.success(views);
  }
}
