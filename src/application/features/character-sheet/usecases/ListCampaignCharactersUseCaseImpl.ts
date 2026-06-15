import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { ListCampaignCharactersQuery } from "@application/features/character-sheet/query/ListCampaignCharactersQuery";
import { ListCampaignCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListCampaignCharactersUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister les fiches rattachées à une campagne » (lecture).
 *
 * Vérifie que la campagne existe, puis renvoie ses fiches rattachées. Toute personne
 * authentifiée connaissant l'identifiant de la campagne peut consulter ses fiches.
 */
export class ListCampaignCharactersUseCaseImpl implements ListCampaignCharactersUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignCharacterRepository: CampaignCharacterRepository,
  ) {}

  public async execute(
    query: ListCampaignCharactersQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const sheets = await this.campaignCharacterRepository.findSheetsByCampaignId(query.campaignId);

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
