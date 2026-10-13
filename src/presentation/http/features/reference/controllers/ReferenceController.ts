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

/** Sentinel renvoyé par `parseProtectionPoints` quand l'entrée n'est pas un nombre exploitable. */
const INVALID = Symbol("INVALID_PROTECTION_POINTS");

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
        statBonuses?: unknown;
        protectionPoints?: unknown;
        description?: unknown;
        competenceIds?: unknown;
      };
      const protectionPoints = ReferenceController.parseProtectionPoints(body.protectionPoints);
      if (protectionPoints === INVALID) {
        ReferenceController.respondInvalidProtectionPoints(res);
        return;
      }
      const result = await uc.create.execute({
        groupId: body.groupId as string,
        actorId: req.user!.userId,
        name: body.name as string,
        stat: (body.stat as string | null | undefined) ?? null,
        bonus: (body.bonus as number | null | undefined) ?? null,
        statBonuses: ReferenceController.parseStatBonuses(body.statBonuses),
        protectionPoints,
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
        statBonuses?: unknown;
        protectionPoints?: unknown;
        description?: unknown;
        competenceIds?: unknown;
      };
      const protectionPoints = ReferenceController.parseProtectionPoints(body.protectionPoints);
      if (protectionPoints === INVALID) {
        ReferenceController.respondInvalidProtectionPoints(res);
        return;
      }
      const result = await uc.update.execute({
        itemId: req.params.id ?? "",
        groupId: body.groupId as string,
        actorId: req.user!.userId,
        name: body.name as string,
        stat: (body.stat as string | null | undefined) ?? null,
        bonus: (body.bonus as number | null | undefined) ?? null,
        statBonuses: ReferenceController.parseStatBonuses(body.statBonuses),
        protectionPoints,
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

  /**
   * Valide les points de protection bruts du corps de requête à la frontière HTTP.
   *
   * Accepte un nombre fini, ou `null`/`undefined` (non renseigné → `null`). Toute autre valeur
   * (chaîne non numérique, `NaN`, booléen…) renvoie le sentinel [INVALID] : un cast `as number`
   * laissait sinon passer un `NaN` jusqu'au stockage. Couvre uniformément création ET mise à jour
   * (cette dernière reconstruit via `restore`, qui ne re-normalise pas).
   */
  private static parseProtectionPoints(value: unknown): number | null | typeof INVALID {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === "number" && Number.isFinite(value) ? value : INVALID;
  }

  private static respondInvalidProtectionPoints(res: Response): void {
    res.status(400).json({
      code: "INVALID_PROTECTION_POINTS",
      message: "Les points de protection doivent être un nombre entier.",
    });
  }

  /**
   * Extrait les bonus de statistique bruts du corps de requête (peuples uniquement).
   *
   * Renvoie `undefined` si le champ est absent — ce qui **déclenche le repli de compatibilité** côté
   * use case : un client antérieur au multi-bonus, qui envoie `stat`/`bonus`, verra son bonus unique
   * converti en une entrée de la liste plutôt que perdu.
   *
   * Défensif par construction : une entrée qui n'est pas un objet est projetée sur une stat vide,
   * que le value object `StatBonus` rejettera proprement en 400 (`INVALID_STAT_BONUS`). Sans ça, un
   * `[null]` dans le tableau ferait planter l'accès `entry.stat` et remonterait en 500.
   */
  private static parseStatBonuses(
    value: unknown,
  ): { stat: string; bonus?: number | null }[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value.map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return { stat: "" };
      }
      const raw = entry as { stat?: unknown; bonus?: unknown };
      return {
        stat: raw.stat as string,
        bonus: (raw.bonus as number | null | undefined) ?? null,
      };
    });
  }

  private static serialize(view: ReferenceItemView): {
    id: string;
    name: string;
    createdAt: string;
    stat: string | null;
    bonus: number | null;
    statBonuses: { stat: string; bonus: number }[];
    protectionPoints: number | null;
    description: string | null;
    competenceIds: string[];
  } {
    return {
      id: view.id,
      name: view.name,
      createdAt: view.createdAt.toISOString(),
      // `stat`/`bonus` : formations (mono-bonus). `statBonuses` : peuples (0..N). Les deux ne sont
      // jamais renseignés en même temps — voir `toView`.
      stat: view.stat,
      bonus: view.bonus,
      statBonuses: view.statBonuses,
      protectionPoints: view.protectionPoints,
      description: view.description,
      competenceIds: view.competenceIds,
    };
  }
}
