import { NextFunction, Request, Response } from "express";
import { CreateCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/CreateCharacterSheetUseCase";
import { ListMyCharacterSheetsUseCase } from "@application/features/character-sheet/abstractions/usecases/ListMyCharacterSheetsUseCase";
import { DeleteCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/DeleteCharacterSheetUseCase";
import { GetCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/GetCharacterSheetUseCase";
import { UpdateCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/UpdateCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { UpdateCharacterSheetCommand } from "@application/features/character-sheet/commands/UpdateCharacterSheetCommand";
import { CharacterSheetHttpMapper } from "@presentation/http/features/character-sheet/mappers/CharacterSheetHttpMapper";

/** Corps brut accepté pour la mise à jour d'une fiche (validation souple côté use case). */
interface UpdateCharacterSheetBody {
  name?: unknown;
  formation?: unknown;
  niveau?: unknown;
  peuple?: unknown;
  sexe?: unknown;
  tailleEtPoids?: unknown;
  age?: unknown;
  apparence?: unknown;
  dexterite?: unknown;
  intelligence?: unknown;
  perception?: unknown;
  social?: unknown;
  vigueur?: unknown;
  pointsDeVie?: unknown;
  pointsDeMagie?: unknown;
  protection?: unknown;
  monnaie?: unknown;
  armes?: unknown;
  armures?: unknown;
  equipement?: unknown;
  sortsEtMiracles?: unknown;
  notes?: unknown;
}

/** Sérialise un `CharacterSheetDetail` (date → ISO) pour la réponse HTTP. */
function toResponse(detail: CharacterSheetDetail): Record<string, unknown> {
  return { ...detail, createdAt: detail.createdAt.toISOString() };
}

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
    private readonly getCharacterSheet: GetCharacterSheetUseCase,
    private readonly updateCharacterSheet: UpdateCharacterSheetUseCase,
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

  /** `GET /character-sheets/:id` — détail complet d'une fiche, si l'utilisateur en est propriétaire. */
  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getCharacterSheet.execute({
        characterSheetId: req.params.id ?? "",
        ownerId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      res.status(200).json(toResponse(result.value));
    } catch (error) {
      next(error);
    }
  };

  /** `PUT /character-sheets/:id` — met à jour une fiche, si l'utilisateur en est propriétaire. */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateCharacterSheetBody;
      const command = this.toUpdateCommand(req.params.id ?? "", req.user!.userId, body);
      const result = await this.updateCharacterSheet.execute(command);

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      res.status(200).json(toResponse(result.value));
    } catch (error) {
      next(error);
    }
  };

  /** Construit la commande de mise à jour à partir du corps brut (texte/nombre, sinon `null`). */
  private toUpdateCommand(
    characterSheetId: string,
    ownerId: string,
    body: UpdateCharacterSheetBody,
  ): UpdateCharacterSheetCommand {
    const text = (value: unknown): string | null =>
      typeof value === "string" ? value : null;
    const num = (value: unknown): number | null =>
      typeof value === "number" ? value : null;

    return {
      characterSheetId,
      ownerId,
      name: text(body.name) ?? "",
      formation: text(body.formation),
      niveau: text(body.niveau),
      peuple: text(body.peuple),
      sexe: text(body.sexe),
      tailleEtPoids: text(body.tailleEtPoids),
      age: text(body.age),
      apparence: text(body.apparence),
      dexterite: num(body.dexterite),
      intelligence: num(body.intelligence),
      perception: num(body.perception),
      social: num(body.social),
      vigueur: num(body.vigueur),
      pointsDeVie: num(body.pointsDeVie),
      pointsDeMagie: num(body.pointsDeMagie),
      protection: num(body.protection),
      monnaie: num(body.monnaie),
      armes: text(body.armes),
      armures: text(body.armures),
      equipement: text(body.equipement),
      sortsEtMiracles: text(body.sortsEtMiracles),
      notes: text(body.notes),
    };
  }

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
