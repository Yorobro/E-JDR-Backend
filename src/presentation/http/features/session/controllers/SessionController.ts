import { NextFunction, Request, Response } from "express";
import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";
import { CreateSessionUseCase } from "@application/features/session/abstractions/usecases/CreateSessionUseCase";
import { ListCampaignSessionsUseCase } from "@application/features/session/abstractions/usecases/ListCampaignSessionsUseCase";
import { GetSessionUseCase } from "@application/features/session/abstractions/usecases/GetSessionUseCase";
import { UpdateSessionUseCase } from "@application/features/session/abstractions/usecases/UpdateSessionUseCase";
import { DeleteSessionUseCase } from "@application/features/session/abstractions/usecases/DeleteSessionUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";
import { SessionHttpMapper } from "@presentation/http/features/session/mappers/SessionHttpMapper";

/**
 * Controller HTTP de la feature session.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours renseigné.
 * L'identité du demandeur (`actorUserId`) est **toujours** prise de la session (`req.user`),
 * jamais du corps. L'autorisation (MJ de la campagne parente) est portée par les use cases ;
 * le controller délègue la traduction des erreurs au `SessionHttpMapper`.
 */
export class SessionController {
  constructor(
    private readonly createSession: CreateSessionUseCase,
    private readonly listCampaignSessions: ListCampaignSessionsUseCase,
    private readonly getSession: GetSessionUseCase,
    private readonly updateSession: UpdateSessionUseCase,
    private readonly deleteSession: DeleteSessionUseCase,
  ) {}

  /**
   * `POST /campaigns/:campaignId/sessions` — crée une session dans la campagne (réservé au MJ).
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { title?: unknown; date?: unknown };
      const result = await this.createSession.execute({
        campaignId: req.params.campaignId ?? "",
        actorUserId: req.user!.userId,
        title: body.title as string,
        date: body.date as string,
      });

      this.respond(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  /**
   * `GET /campaigns/:campaignId/sessions` — liste les sessions de la campagne (réservé au MJ).
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listCampaignSessions.execute({
        campaignId: req.params.campaignId ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        this.fail(res, result.error);
        return;
      }

      res.status(200).json({ sessions: result.value.map(SessionController.serialize) });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `GET /sessions/:id` — retourne le détail d'une session (réservé au MJ de sa campagne).
   */
  public get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getSession.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
      });

      this.respond(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * `PUT /sessions/:id` — met à jour le titre/la date d'une session (réservé au MJ).
   */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { title?: unknown; date?: unknown };
      const result = await this.updateSession.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
        title: body.title as string,
        date: body.date as string,
      });

      this.respond(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * `DELETE /sessions/:id` — supprime une session (réservé au MJ de sa campagne).
   */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteSession.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        this.fail(res, result.error);
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** Répond avec la session sérialisée et le statut de succès donné, ou délègue l'échec. */
  private respond(res: Response, result: Result<SessionView, AppError>, okStatus: number): void {
    if (result.isFailure) {
      this.fail(res, result.error);
      return;
    }
    res.status(okStatus).json(SessionController.serialize(result.value));
  }

  /** Émet une réponse d'erreur (statut HTTP + code/message applicatifs). */
  private fail(res: Response, error: AppError): void {
    res.status(SessionHttpMapper.statusFor(error)).json({ code: error.code, message: error.message });
  }

  /** Sérialise une `SessionView` pour le transport JSON (`createdAt` en ISO). */
  private static serialize(view: SessionView): {
    id: string;
    campaignId: string;
    title: string;
    date: string;
    createdAt: string;
  } {
    return {
      id: view.id,
      campaignId: view.campaignId,
      title: view.title,
      date: view.date,
      createdAt: view.createdAt.toISOString(),
    };
  }
}
