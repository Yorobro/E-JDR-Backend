import { NextFunction, Request, Response } from "express";
import { LinkCharacterToCampaignUseCase } from "@application/features/character-sheet/abstractions/usecases/LinkCharacterToCampaignUseCase";
import { UnlinkCharacterFromCampaignUseCase } from "@application/features/character-sheet/abstractions/usecases/UnlinkCharacterFromCampaignUseCase";
import { ListCampaignCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListCampaignCharactersUseCase";
import { CharacterSheetHttpMapper } from "@presentation/http/features/character-sheet/mappers/CharacterSheetHttpMapper";

/**
 * Controller HTTP de la liaison campagne↔fiches (sous `/campaigns/:campaignId/characters`).
 *
 * Monté derrière le middleware d'authentification : `req.user` est toujours renseigné.
 * L'identité du demandeur (`actorUserId`) est prise de la session, jamais du corps.
 */
export class CampaignCharacterController {
  constructor(
    private readonly linkCharacter: LinkCharacterToCampaignUseCase,
    private readonly unlinkCharacter: UnlinkCharacterFromCampaignUseCase,
    private readonly listCampaignCharacters: ListCampaignCharactersUseCase,
  ) {}

  /** `POST /campaigns/:campaignId/characters` — rattache une fiche à la campagne. */
  public link = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { characterSheetId?: unknown };
      const result = await this.linkCharacter.execute({
        campaignId: req.params.campaignId ?? "",
        characterSheetId: (body.characterSheetId as string) ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      res.status(201).send();
    } catch (error) {
      next(error);
    }
  };

  /** `DELETE /campaigns/:campaignId/characters/:characterSheetId` — détache une fiche. */
  public unlink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.unlinkCharacter.execute({
        campaignId: req.params.campaignId ?? "",
        characterSheetId: req.params.characterSheetId ?? "",
        actorUserId: req.user!.userId,
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

  /** `GET /campaigns/:campaignId/characters` — liste les fiches rattachées à la campagne. */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listCampaignCharacters.execute({
        campaignId: req.params.campaignId ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const characters = result.value.map((sheet) => ({
        id: sheet.id,
        ownerId: sheet.ownerId,
        name: sheet.name,
        createdAt: sheet.createdAt.toISOString(),
      }));
      res.status(200).json({ characters });
    } catch (error) {
      next(error);
    }
  };
}
