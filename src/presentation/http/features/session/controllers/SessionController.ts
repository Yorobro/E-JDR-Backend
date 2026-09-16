import { NextFunction, Request, Response } from "express";
import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";
import { CreateSessionUseCase } from "@application/features/session/abstractions/usecases/CreateSessionUseCase";
import { CreateLobbyUseCase } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { ListCampaignSessionsUseCase } from "@application/features/session/abstractions/usecases/ListCampaignSessionsUseCase";
import { GetSessionUseCase } from "@application/features/session/abstractions/usecases/GetSessionUseCase";
import { UpdateSessionUseCase } from "@application/features/session/abstractions/usecases/UpdateSessionUseCase";
import { DeleteSessionUseCase } from "@application/features/session/abstractions/usecases/DeleteSessionUseCase";
import { RespondToInvitationUseCase } from "@application/features/session/abstractions/usecases/RespondToInvitationUseCase";
import { ListMySessionInvitationsUseCase } from "@application/features/session/abstractions/usecases/ListMySessionInvitationsUseCase";
import { GetSessionLobbyUseCase } from "@application/features/session/abstractions/usecases/GetSessionLobbyUseCase";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";
import { SessionHttpMapper } from "@presentation/http/features/session/mappers/SessionHttpMapper";

/**
 * Regroupe les use cases injectés dans le {@link SessionController}.
 *
 * Passés en un seul objet (plutôt qu'en paramètres positionnels) pour rester sous la limite de
 * paramètres du controller et garder l'assemblage lisible à mesure que la feature grandit.
 */
export interface SessionControllerUseCases {
  readonly createSession: CreateSessionUseCase;
  readonly createLobby: CreateLobbyUseCase;
  readonly listCampaignSessions: ListCampaignSessionsUseCase;
  readonly getSession: GetSessionUseCase;
  readonly updateSession: UpdateSessionUseCase;
  readonly deleteSession: DeleteSessionUseCase;
  readonly respondToInvitation: RespondToInvitationUseCase;
  readonly listMyInvitations: ListMySessionInvitationsUseCase;
  readonly getSessionLobby: GetSessionLobbyUseCase;
}

/**
 * Controller HTTP de la feature session.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours renseigné.
 * L'identité du demandeur (`actorUserId`) est **toujours** prise de la session (`req.user`),
 * jamais du corps. L'autorisation (MJ de la campagne parente) est portée par les use cases ;
 * le controller délègue la traduction des erreurs au `SessionHttpMapper`.
 */
export class SessionController {
  private readonly createSession: CreateSessionUseCase;
  private readonly createLobby: CreateLobbyUseCase;
  private readonly listCampaignSessions: ListCampaignSessionsUseCase;
  private readonly getSession: GetSessionUseCase;
  private readonly updateSession: UpdateSessionUseCase;
  private readonly deleteSession: DeleteSessionUseCase;
  private readonly respondToInvitation: RespondToInvitationUseCase;
  private readonly listMyInvitations: ListMySessionInvitationsUseCase;
  private readonly getSessionLobby: GetSessionLobbyUseCase;

  constructor(useCases: SessionControllerUseCases) {
    this.createSession = useCases.createSession;
    this.createLobby = useCases.createLobby;
    this.listCampaignSessions = useCases.listCampaignSessions;
    this.getSession = useCases.getSession;
    this.updateSession = useCases.updateSession;
    this.deleteSession = useCases.deleteSession;
    this.respondToInvitation = useCases.respondToInvitation;
    this.listMyInvitations = useCases.listMyInvitations;
    this.getSessionLobby = useCases.getSessionLobby;
  }

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

      this.respondWith(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  /**
   * `POST /sessions/:id/launch` — ouvre le lobby (réservé au MJ) et invite les joueurs cochés.
   *
   * Le corps porte `participantUserIds` (identifiants des joueurs sélectionnés). L'identité du
   * MJ est prise de la session authentifiée, jamais du corps. Renvoie le lobby (statut `LOBBY`
   * + liste des invitations).
   */
  public launch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { participantUserIds?: unknown };
      const result = await this.createLobby.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
        participantUserIds: Array.isArray(body.participantUserIds)
          ? (body.participantUserIds as string[])
          : [],
      });

      if (result.isFailure) {
        this.fail(res, result.error);
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      next(error);
    }
  };

  /**
   * `POST /sessions/:id/respond` — un joueur convié accepte ou refuse son invitation.
   *
   * Le corps porte `accept` (booléen) : `true` rejoint le lobby (ACCEPTED), toute autre valeur
   * refuse (REFUSED). L'identité du joueur est prise de la session authentifiée, jamais du corps.
   * Renvoie `204 No Content` en cas de succès.
   */
  public respond = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { accept?: unknown };
      const result = await this.respondToInvitation.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
        accept: body.accept === true,
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

  /**
   * `GET /sessions/invitations` — liste les invitations de session en attente du joueur courant.
   *
   * Le demandeur est pris de la session authentifiée. Renvoie `200` avec `{ invitations: [...] }`.
   */
  public listInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.listMyInvitations.execute({ actorUserId: req.user!.userId });

      if (result.isFailure) {
        this.fail(res, result.error);
        return;
      }

      res.status(200).json({ invitations: result.value });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `GET /sessions/:id/lobby` — retourne le lobby (statut + participants) d'une session.
   *
   * Accessible à tout membre du groupe de la campagne (MJ comme joueur convié). Sert au joueur
   * qui rejoint le salon d'attente et au MJ en reprise à froid.
   */
  public getLobby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getSessionLobby.execute({
        sessionId: req.params.id ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        this.fail(res, result.error);
        return;
      }

      res.status(200).json(result.value);
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

      this.respondWith(res, result, 200);
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

      this.respondWith(res, result, 200);
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
  private respondWith(
    res: Response,
    result: Result<SessionView, AppError>,
    okStatus: number,
  ): void {
    if (result.isFailure) {
      this.fail(res, result.error);
      return;
    }
    res.status(okStatus).json(SessionController.serialize(result.value));
  }

  /** Émet une réponse d'erreur (statut HTTP + code/message applicatifs). */
  private fail(res: Response, error: AppError): void {
    res
      .status(SessionHttpMapper.statusFor(error))
      .json({ code: error.code, message: error.message });
  }

  /** Sérialise une `SessionView` pour le transport JSON (`createdAt` en ISO). */
  private static serialize(view: SessionView): {
    id: string;
    campaignId: string;
    title: string;
    date: string;
    status: string;
    createdAt: string;
  } {
    return {
      id: view.id,
      campaignId: view.campaignId,
      title: view.title,
      date: view.date,
      status: view.status,
      createdAt: view.createdAt.toISOString(),
    };
  }
}
