import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";
import { GetSheetCampaignsQuery } from "@application/features/character-sheet/query/GetSheetCampaignsQuery";
import { GetSheetCampaignsUseCase } from "@application/features/character-sheet/abstractions/usecases/GetSheetCampaignsUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case listant **la** campagne d'une fiche (modèle « une fiche = une campagne »), enrichie du
 * pseudo du MJ et du statut de rattachement.
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**
 * (`sheet.isOwnedBy`), puis projette la vue de campagne unique. Le contrat reste un **tableau**
 * (0 ou 1 élément) pour ne pas casser les consommateurs existants. Lecture pure (sans `UnitOfWork`).
 */
export class GetSheetCampaignsUseCaseImpl implements GetSheetCampaignsUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
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
      this.logger.warn(
        "Tentative de consultation de la campagne d'une fiche par un non-propriétaire",
        {
          characterSheetId: query.characterSheetId,
          ownerId: query.ownerId,
        },
      );
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const view = await this.characterSheetRepository.findCampaignViewBySheetId(
      query.characterSheetId,
    );
    return Result.success(view === null ? [] : [view]);
  }
}
