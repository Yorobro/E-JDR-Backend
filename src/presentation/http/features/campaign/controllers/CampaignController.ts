import { NextFunction, Request, Response } from "express";
import { CreateCampaignUseCase } from "@application/features/campaign/abstractions/usecases/CreateCampaignUseCase";
import { ListMyCampaignsUseCase } from "@application/features/campaign/abstractions/usecases/ListMyCampaignsUseCase";
import { DeleteCampaignUseCase } from "@application/features/campaign/abstractions/usecases/DeleteCampaignUseCase";
import { CampaignHttpMapper } from "@presentation/http/features/campaign/mappers/CampaignHttpMapper";

export class CampaignController {
  constructor(
    private readonly createCampaign: CreateCampaignUseCase,
    private readonly listMyCampaigns: ListMyCampaignsUseCase,
    private readonly deleteCampaign: DeleteCampaignUseCase,
  ) {}

  /** `POST /campaigns` — crée une campagne dans le groupe indiqué. */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { name?: unknown; groupId?: unknown };
      const result = await this.createCampaign.execute({
        groupId: body.groupId as string,
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

  /** `GET /campaigns?groupId=…` — liste les campagnes du groupe (membre requis). */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listMyCampaigns.execute({
        groupId: (req.query.groupId as string) ?? "",
        userId: req.user!.userId,
      });

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

  /** `DELETE /campaigns/:id` — supprime une campagne si l'utilisateur en est le maître du jeu. */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
