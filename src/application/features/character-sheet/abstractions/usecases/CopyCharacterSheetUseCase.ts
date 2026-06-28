import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CopyCharacterSheetCommand } from "@application/features/character-sheet/commands/CopyCharacterSheetCommand";

/** Résultat de succès d'une copie de fiche : les informations publiques de la nouvelle fiche. */
export interface CopyCharacterSheetResult {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt: Date;
}

/**
 * Port « in » du use case « copier une fiche vers une autre campagne » (nouvelle fiche PENDING).
 */
export interface CopyCharacterSheetUseCase {
  execute(command: CopyCharacterSheetCommand): Promise<Result<CopyCharacterSheetResult, AppError>>;
}
