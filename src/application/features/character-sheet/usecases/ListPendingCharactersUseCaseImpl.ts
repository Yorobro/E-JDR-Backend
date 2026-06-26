import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ListCampaignCharactersQuery } from "@application/features/character-sheet/query/ListCampaignCharactersQuery";
import { ListPendingCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListPendingCharactersUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case « lister les demandes de rattachement en attente (PENDING) d'une campagne » (lecture).
 *
 * Réservé au **maître du jeu** de la campagne : c'est lui qui valide/refuse les demandes depuis
 * le détail de la campagne.
 */
export class ListPendingCharactersUseCaseImpl implements ListPendingCharactersUseCase {
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

    if (!campaign.isGameMaster(query.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const sheets = await this.characterSheetRepository.findByCampaignIdAndStatus(
      query.campaignId,
      "PENDING",
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
