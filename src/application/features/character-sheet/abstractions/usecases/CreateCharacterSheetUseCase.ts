import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CreateCharacterSheetCommand } from "@application/features/character-sheet/commands/CreateCharacterSheetCommand";

/** Résultat de succès d'une création de fiche : ses informations publiques. */
export interface CreateCharacterSheetResult {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt: Date;
}

/** Port « in » du use case de création de fiche de personnage. */
export interface CreateCharacterSheetUseCase {
  execute(
    command: CreateCharacterSheetCommand,
  ): Promise<Result<CreateCharacterSheetResult, AppError>>;
}
