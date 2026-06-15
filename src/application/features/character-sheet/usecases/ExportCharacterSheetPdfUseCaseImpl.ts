import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { ExportCharacterSheetPdfQuery } from "@application/features/character-sheet/query/ExportCharacterSheetPdfQuery";
import { ExportCharacterSheetPdfUseCase } from "@application/features/character-sheet/abstractions/usecases/ExportCharacterSheetPdfUseCase";
import { ExportedCharacterSheetPdf } from "@application/features/character-sheet/abstractions/usecases/ExportedCharacterSheetPdf";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";

/**
 * Dérive un nom de fichier sûr à partir du nom de la fiche.
 *
 * Slugifie : retire les accents (NFD), ne garde que `[a-zA-Z0-9-_ ]`, trim, remplace les
 * espaces par des tirets, passe en minuscules. Repli sur "fiche" si le slug est vide.
 *
 * @param name - Le nom de la fiche.
 * @returns Le nom de fichier `fiche-{slug}.pdf`.
 */
function toPdfFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `fiche-${slug.length > 0 ? slug : "fiche"}.pdf`;
}

/**
 * Use case d'export PDF d'une fiche de personnage.
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**
 * (`sheet.isOwnedBy`), projette la fiche complète puis délègue le rendu au générateur PDF.
 * Lecture pure (sans `UnitOfWork`).
 */
export class ExportCharacterSheetPdfUseCaseImpl implements ExportCharacterSheetPdfUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly pdfGenerator: CharacterSheetPdfGenerator,
    private readonly logger: Logger,
  ) {}

  public async execute(
    query: ExportCharacterSheetPdfQuery,
  ): Promise<Result<ExportedCharacterSheetPdf, AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    if (!sheet.isOwnedBy(query.ownerId)) {
      this.logger.warn("Tentative d'export d'une fiche par un non-propriétaire", {
        characterSheetId: query.characterSheetId,
        ownerId: query.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const detail = toCharacterSheetDetail(sheet);
    const pdf = await this.pdfGenerator.generate(detail);
    return Result.success({ pdf, fileName: toPdfFileName(detail.name) });
  }
}
