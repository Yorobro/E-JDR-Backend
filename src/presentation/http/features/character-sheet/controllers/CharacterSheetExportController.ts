import { NextFunction, Request, Response } from "express";
import { ExportCharacterSheetPdfUseCase } from "@application/features/character-sheet/abstractions/usecases/ExportCharacterSheetPdfUseCase";
import { CharacterSheetHttpMapper } from "@presentation/http/features/character-sheet/mappers/CharacterSheetHttpMapper";

/**
 * Controller HTTP dédié à l'export PDF d'une fiche de personnage.
 *
 * Controller séparé du CRUD (`CharacterSheetController`, déjà au plafond de 6 dépendances) :
 * il porte une seule responsabilité et reste indépendant. Monté derrière le middleware
 * d'authentification : `req.user` est toujours renseigné, et le `ownerId` provient de la session.
 */
export class CharacterSheetExportController {
  constructor(private readonly exportCharacterSheetPdf: ExportCharacterSheetPdfUseCase) {}

  /** `GET /character-sheets/:id/export-pdf` — renvoie le PDF de la fiche (propriétaire seul). */
  public exportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.exportCharacterSheetPdf.execute({
        characterSheetId: req.params.id ?? "",
        ownerId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const { pdf, fileName } = result.value;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  };
}
