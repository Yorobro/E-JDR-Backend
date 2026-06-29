import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ListCampaignCharactersQuery } from "@application/features/character-sheet/query/ListCampaignCharactersQuery";
import { ListCampaignCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListCampaignCharactersUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister les fiches **validées** (ACCEPTED) d'une campagne » (lecture).
 *
 * Vérifie que la campagne existe, puis renvoie les fiches réellement rattachées (statut ACCEPTED ;
 * les demandes PENDING ne sont visibles que du MJ via {@link ListPendingCharactersUseCase}). Toute
 * personne authentifiée connaissant l'identifiant de la campagne peut consulter ses personnages.
 */
export class ListCampaignCharactersUseCaseImpl implements ListCampaignCharactersUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
  ) {}

  public async execute(
    query: ListCampaignCharactersQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const sheets = await this.characterSheetRepository.findByCampaignIdAndStatus(
      query.campaignId,
      "ACCEPTED",
    );

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
      campaignId: campaign.id,
      campaignName: campaign.name.value,
      linkStatus: "ACCEPTED",
    }));

    return Result.success(summaries);
  }
}
