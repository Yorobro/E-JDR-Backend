import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListCampaignCharactersQuery } from "@application/features/character-sheet/query/ListCampaignCharactersQuery";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/** Port « in » du use case « lister les fiches rattachées à une campagne ». */
export interface ListCampaignCharactersUseCase {
  execute(query: ListCampaignCharactersQuery): Promise<Result<CharacterSheetSummary[], AppError>>;
}
