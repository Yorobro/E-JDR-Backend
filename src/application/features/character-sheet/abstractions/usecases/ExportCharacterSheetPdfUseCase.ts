import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ExportCharacterSheetPdfQuery } from "@application/features/character-sheet/query/ExportCharacterSheetPdfQuery";
import { ExportedCharacterSheetPdf } from "@application/features/character-sheet/abstractions/usecases/ExportedCharacterSheetPdf";

/** Port « in » du use case d'export PDF d'une fiche de personnage. */
export interface ExportCharacterSheetPdfUseCase {
  execute(
    query: ExportCharacterSheetPdfQuery,
  ): Promise<Result<ExportedCharacterSheetPdf, AppError>>;
}
