import { NextFunction, Request, Response } from "express";
import { CreateCampaignUseCase } from "@application/features/campaign/abstractions/usecases/CreateCampaignUseCase";
import { ListMyCampaignsUseCase } from "@application/features/campaign/abstractions/usecases/ListMyCampaignsUseCase";
import { DeleteCampaignUseCase } from "@application/features/campaign/abstractions/usecases/DeleteCampaignUseCase";
import { CampaignHttpMapper } from "@presentation/http/features/campaign/mappers/CampaignHttpMapper";

/**
 * Controller HTTP de la feature campaign.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours renseigné.
 * Le maître du jeu (`gameMasterId`) est **toujours** pris de la session (`req.user`), jamais
 * du corps de la requête. Comme les autres controllers, il ne dépend que des interfaces de
 * use cases et délègue la traduction des erreurs au `CampaignHttpMapper`.
 */
export class CampaignController {
  /**
   * @param createCampaign - Use case de création de campagne.
   * @param listMyCampaigns - Use case de listing des campagnes du MJ courant.
   */
  constructor(
    private readonly createCampaign: CreateCampaignUseCase,
    private readonly listMyCampaigns: ListMyCampaignsUseCase,
    private readonly deleteCampaign: DeleteCampaignUseCase,
  ) {}

  /**
   * `POST /campaigns` — crée une campagne dont l'utilisateur authentifié est le maître du jeu.
   *
   * @param req - La requête (`name` dans le corps, identité dans `req.user`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { name?: unknown };
      const result = await this.createCampaign.execute({
        gameMasterId: req.user!.userId,
        name: body.name as string,
      });

      if (result.isFailure) {
        res
          .status(CampaignHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const { id, name, createdAt } = result.value;
      res.status(201).json({ id, name, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `GET /campaigns` — liste les campagnes dont l'utilisateur authentifié est le maître du jeu.
   *
   * @param req - La requête (identité dans `req.user`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listMyCampaigns.execute({ gameMasterId: req.user!.userId });

      if (result.isFailure) {
        res
          .status(CampaignHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const campaigns = result.value.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt.toISOString(),
      }));
      res.status(200).json({ campaigns });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `DELETE /campaigns/:id` — supprime une campagne si l'utilisateur en est le maître du jeu.
   *
   * @param req - La requête (`id` dans les paramètres de route, identité dans `req.user`).
   * @param res - La réponse (`204 No Content` en cas de succès).
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Le paramètre de route `:id` est toujours présent au runtime ; le typage Express
      // le déclare optionnel, d'où le repli sur "" (traité comme introuvable → 404).
      const result = await this.deleteCampaign.execute({
        campaignId: req.params.id ?? "",
        gameMasterId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CampaignHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
