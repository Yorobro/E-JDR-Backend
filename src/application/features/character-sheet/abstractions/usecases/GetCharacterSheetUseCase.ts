import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GetCharacterSheetQuery } from "@application/features/character-sheet/query/GetCharacterSheetQuery";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/** Port « in » du use case de consultation détaillée d'une fiche de personnage. */
export interface GetCharacterSheetUseCase {
  execute(query: GetCharacterSheetQuery): Promise<Result<CharacterSheetDetail, AppError>>;
}
