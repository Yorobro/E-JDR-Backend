import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UpdateCharacterSheetCommand } from "@application/features/character-sheet/commands/UpdateCharacterSheetCommand";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/** Port « in » du use case de mise à jour d'une fiche de personnage. */
export interface UpdateCharacterSheetUseCase {
  execute(command: UpdateCharacterSheetCommand): Promise<Result<CharacterSheetDetail, AppError>>;
}
