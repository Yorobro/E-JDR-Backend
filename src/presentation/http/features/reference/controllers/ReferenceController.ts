import { NextFunction, Request, Response } from "express";
import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";
import {
  CreateReferenceItemUseCase,
  DeleteReferenceItemUseCase,
  ListReferenceItemsUseCase,
  UpdateReferenceItemUseCase,
} from "@application/features/reference/abstractions/usecases/ReferenceCatalogueUseCases";
import {
  LinkSheetReferenceUseCase,
  ListSheetReferencesUseCase,
  UnlinkSheetReferenceUseCase,
} from "@application/features/reference/abstractions/usecases/SheetReferenceLinkUseCases";
import { ReferenceHttpMapper } from "@presentation/http/features/reference/mappers/ReferenceHttpMapper";

/** Use cases du catalogue d'un type donné (formation, peuple, arme, …). */
export interface CatalogueUseCases {
  readonly create: CreateReferenceItemUseCase;
  readonly list: ListReferenceItemsUseCase;
  readonly update: UpdateReferenceItemUseCase;
  readonly remove: DeleteReferenceItemUseCase;
}

/** Use cases de liaison fiche↔éléments d'un type liable (arme, armure, compétence, équipement). */
export interface LinkUseCases {
  readonly link: LinkSheetReferenceUseCase;
  readonly unlink: UnlinkSheetReferenceUseCase;
  readonly list: ListSheetReferencesUseCase;
}

export class ReferenceController {
  constructor(
    private readonly catalogues: Record<string, CatalogueUseCases>,
    private readonly links: Record<string, LinkUseCases>,
  ) {}

  /** `POST /reference/:type` — crée un élément dans le catalogue du groupe (admin requis). */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.catalogues[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const body = req.body as {
        name?: unknown;
        groupId?: unknown;
        stat?: unknown;
        bonus?: unknown;
        protectionPoints?: unknown;
        description?: unknown;
        competenceIds?: unknown;
      };
      const result = await uc.create.execute({
        groupId: body.groupId as string,
        actorId: req.user!.userId,
        name: body.name as string,
        stat: (body.stat as string | null | undefined) ?? null,
        bonus: (body.bonus as number | null | undefined) ?? null,
        protectionPoints: (body.protectionPoints as number | null | undefined) ?? null,
        description: (body.description as string | null | undefined) ?? null,
        competenceIds: Array.isArray(body.competenceIds)
          ? (body.competenceIds as string[])
          : undefined,
      });
      ReferenceController.respondItem(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  /** `GET /reference/:type?groupId=…` — liste les éléments du groupe (membre requis). */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.catalogues[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const result = await uc.list.execute({
        groupId: (req.query.groupId as string) ?? "",
        actorId: req.user!.userId,
      });
      ReferenceController.respondList(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** `PUT /reference/:type/:id` — modifie un élément du catalogue (admin requis, remplacement complet). */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.catalogues[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const body = req.body as {
        name?: unknown;
        groupId?: unknown;
        stat?: unknown;
        bonus?: unknown;
        protectionPoints?: unknown;
        description?: unknown;
        competenceIds?: unknown;
      };
      const result = await uc.update.execute({
        itemId: req.params.id ?? "",
        groupId: body.groupId as string,
        actorId: req.user!.userId,
        name: body.name as string,
        stat: (body.stat as string | null | undefined) ?? null,
        bonus: (body.bonus as number | null | undefined) ?? null,
        protectionPoints: (body.protectionPoints as number | null | undefined) ?? null,
        description: (body.description as string | null | undefined) ?? null,
        competenceIds: Array.isArray(body.competenceIds)
          ? (body.competenceIds as string[])
          : undefined,
      });
      ReferenceController.respondItem(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  /** `DELETE /reference/:type/:id` — supprime un élément du catalogue (admin requis). */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.catalogues[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const result = await uc.remove.execute({
        itemId: req.params.id ?? "",
        actorId: req.user!.userId,
      });
      if (result.isFailure) {
        ReferenceController.fail(res, result.error);
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** `POST /character-sheets/:id/:type` — rattache un élément (type liable) à la fiche. */
  public link = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.links[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const body = req.body as { itemId?: unknown };
      const result = await uc.link.execute({
        sheetId: req.params.id ?? "",
        itemId: (body.itemId as string) ?? "",
        actorUserId: req.user!.userId,
      });
      if (result.isFailure) {
        ReferenceController.fail(res, result.error);
        return;
      }
      res.status(201).send();
    } catch (error) {
      next(error);
    }
  };

  /** `GET /character-sheets/:id/:type` — liste les éléments (type liable) rattachés à la fiche. */
  public listLinked = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.links[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const result = await uc.list.execute({
        sheetId: req.params.id ?? "",
        actorUserId: req.user!.userId,
      });
      ReferenceController.respondList(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** `DELETE /character-sheets/:id/:type/:itemId` — détache un élément de la fiche. */
  public unlink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uc = this.links[req.params.type ?? ""];
      if (uc === undefined) {
        res.status(404).json({ code: "REFERENCE_ITEM_NOT_FOUND", message: "Type inconnu." });
        return;
      }
      const result = await uc.unlink.execute({
        sheetId: req.params.id ?? "",
        itemId: req.params.itemId ?? "",
        actorUserId: req.user!.userId,
      });
      if (result.isFailure) {
        ReferenceController.fail(res, result.error);
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  private static respondItem(
    res: Response,
    result: Result<ReferenceItemView, AppError>,
    okStatus: number,
  ): void {
    if (result.isFailure) {
      ReferenceController.fail(res, result.error);
      return;
    }
    res.status(okStatus).json(ReferenceController.serialize(result.value));
  }

  private static respondList(res: Response, result: Result<ReferenceItemView[], AppError>): void {
    if (result.isFailure) {
      ReferenceController.fail(res, result.error);
      return;
    }
    res.status(200).json({ items: result.value.map(ReferenceController.serialize) });
  }

  private static fail(res: Response, error: AppError): void {
    res
      .status(ReferenceHttpMapper.statusFor(error))
      .json({ code: error.code, message: error.message });
  }

  private static serialize(view: ReferenceItemView): {
    id: string;
    name: string;
    createdAt: string;
    stat: string | null;
    bonus: number | null;
    protectionPoints: number | null;
    description: string | null;
    competenceIds: string[];
  } {
    return {
      id: view.id,
      name: view.name,
      createdAt: view.createdAt.toISOString(),
      stat: view.stat,
      bonus: view.bonus,
      protectionPoints: view.protectionPoints,
      description: view.description,
      competenceIds: view.competenceIds,
    };
  }
}
