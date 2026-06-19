import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { ListLinkableCharactersQuery } from "@application/features/character-sheet/query/ListLinkableCharactersQuery";
import { ListLinkableCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister les fiches rattachables à une campagne » (lecture pure).
 *
 * Réservé au maître du jeu : il peut rattacher n'importe quelle fiche d'un AUTRE joueur. La liste
 * exclut ses propres fiches (règle MJ≠joueur) et les fiches déjà rattachées à la campagne.
 */
export class ListLinkableCharactersUseCaseImpl implements ListLinkableCharactersUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
  ) {}

  public async execute(
    query: ListLinkableCharactersQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    if (!campaign.isGameMaster(query.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const sheets = await this.characterSheetRepository.findLinkableForCampaign(
      campaign.groupId,
      query.actorUserId,
      query.campaignId,
    );

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
