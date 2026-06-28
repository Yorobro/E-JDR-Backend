import { NextFunction, Request, Response } from "express";
import { ListCampaignCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListCampaignCharactersUseCase";
import { ListPendingCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListPendingCharactersUseCase";
import { RespondToCampaignLinkRequestUseCase } from "@application/features/character-sheet/abstractions/usecases/RespondToCampaignLinkRequestUseCase";
import { CharacterSheetHttpMapper } from "@presentation/http/features/character-sheet/mappers/CharacterSheetHttpMapper";

/**
 * Controller HTTP des personnages d'une campagne (sous `/campaigns/:campaignId/...`).
 *
 * Modèle « une fiche = une campagne » : la fiche est rattachée à la création (statut PENDING) ;
 * le MJ **valide** (`accept`) ou **refuse** (suppression) les demandes en attente. Plus de
 * rattachement/détachement manuel.
 *
 * Monté derrière le middleware d'authentification : `req.user` est toujours renseigné. L'identité
 * du demandeur (`actorUserId`) est prise de la session, jamais du corps.
 */
export class CampaignCharacterController {
  constructor(
    private readonly listCampaignCharacters: ListCampaignCharactersUseCase,
    private readonly listPendingCharacters: ListPendingCharactersUseCase,
    private readonly respondToLinkRequest: RespondToCampaignLinkRequestUseCase,
  ) {}

  /** `GET /campaigns/:campaignId/characters` — liste les fiches **validées** (ACCEPTED). */
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

  /**
   * `GET /campaigns/:campaignId/pending-characters` — demandes de rattachement en attente
   * (PENDING), réservé au MJ de la campagne.
   */
  public listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listPendingCharacters.execute({
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

  /**
   * `POST /campaigns/:campaignId/characters/:characterSheetId/accept` — le MJ valide une demande
   * de rattachement (PENDING → ACCEPTED).
   */
  public accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await this.respond(req, res, next, true);
  };

  /**
   * `POST /campaigns/:campaignId/characters/:characterSheetId/refuse` — le MJ refuse une demande
   * de rattachement : **la fiche est supprimée**.
   */
  public refuse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await this.respond(req, res, next, false);
  };

  /** Factorise la réponse du MJ à une demande de rattachement (accept/refuse). */
  private async respond(
    req: Request,
    res: Response,
    next: NextFunction,
    accept: boolean,
  ): Promise<void> {
    try {
      const result = await this.respondToLinkRequest.execute({
        campaignId: req.params.campaignId ?? "",
        characterSheetId: req.params.characterSheetId ?? "",
        actorUserId: req.user!.userId,
        accept,
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
  }
}
