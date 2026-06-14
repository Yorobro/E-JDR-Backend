import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListLinkableCharactersQuery } from "@application/features/character-sheet/query/ListLinkableCharactersQuery";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/** Port « in » du use case « lister les fiches rattachables à une campagne ». */
export interface ListLinkableCharactersUseCase {
  execute(query: ListLinkableCharactersQuery): Promise<Result<CharacterSheetSummary[], AppError>>;
}
