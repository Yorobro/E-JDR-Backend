import { NextFunction, Request, Response } from "express";
import { CreateCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/CreateCharacterSheetUseCase";
import { ListMyCharacterSheetsUseCase } from "@application/features/character-sheet/abstractions/usecases/ListMyCharacterSheetsUseCase";
import { DeleteCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/DeleteCharacterSheetUseCase";
import { CharacterSheetHttpMapper } from "@presentation/http/features/character-sheet/mappers/CharacterSheetHttpMapper";

/**
 * Controller HTTP des fiches de personnage (CRUD des fiches de l'utilisateur courant).
 *
 * Monté derrière le middleware d'authentification : `req.user` est toujours renseigné. Le
 * `ownerId` est **toujours** pris de la session, jamais du corps de la requête.
 */
export class CharacterSheetController {
  constructor(
    private readonly createCharacterSheet: CreateCharacterSheetUseCase,
    private readonly listMyCharacterSheets: ListMyCharacterSheetsUseCase,
    private readonly deleteCharacterSheet: DeleteCharacterSheetUseCase,
  ) {}

  /** `POST /character-sheets` — crée une fiche appartenant à l'utilisateur authentifié. */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { name?: unknown };
      const result = await this.createCharacterSheet.execute({
        ownerId: req.user!.userId,
        name: body.name as string,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const { id, ownerId, name, createdAt } = result.value;
      res.status(201).json({ id, ownerId, name, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /** `GET /character-sheets` — liste les fiches de l'utilisateur authentifié. */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listMyCharacterSheets.execute({ ownerId: req.user!.userId });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const characterSheets = result.value.map((sheet) => ({
        id: sheet.id,
        ownerId: sheet.ownerId,
        name: sheet.name,
        createdAt: sheet.createdAt.toISOString(),
      }));
      res.status(200).json({ characterSheets });
    } catch (error) {
      next(error);
    }
  };

  /** `DELETE /character-sheets/:id` — supprime une fiche si l'utilisateur en est le propriétaire. */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteCharacterSheet.execute({
        characterSheetId: req.params.id ?? "",
        ownerId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
