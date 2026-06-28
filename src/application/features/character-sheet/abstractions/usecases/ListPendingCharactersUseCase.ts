import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListCampaignCharactersQuery } from "@application/features/character-sheet/query/ListCampaignCharactersQuery";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Port « in » du use case « lister les demandes de rattachement en attente d'une campagne »
 * (fiches PENDING), réservé au maître du jeu de la campagne.
 */
export interface ListPendingCharactersUseCase {
  execute(query: ListCampaignCharactersQuery): Promise<Result<CharacterSheetSummary[], AppError>>;
}
