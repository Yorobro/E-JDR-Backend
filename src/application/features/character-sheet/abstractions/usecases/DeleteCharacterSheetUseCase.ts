import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { DeleteCharacterSheetCommand } from "@application/features/character-sheet/commands/DeleteCharacterSheetCommand";

/** Port « in » du use case de suppression de fiche. */
export interface DeleteCharacterSheetUseCase {
  execute(command: DeleteCharacterSheetCommand): Promise<Result<void, AppError>>;
}
