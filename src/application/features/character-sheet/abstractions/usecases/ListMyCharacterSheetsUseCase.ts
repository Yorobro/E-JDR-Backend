import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListMyCharacterSheetsQuery } from "@application/features/character-sheet/query/ListMyCharacterSheetsQuery";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/** Port « in » du use case « lister mes fiches ». */
export interface ListMyCharacterSheetsUseCase {
  execute(query: ListMyCharacterSheetsQuery): Promise<Result<CharacterSheetSummary[], AppError>>;
}
