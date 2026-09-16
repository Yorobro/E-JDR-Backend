import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListMySessionInvitationsQuery } from "@application/features/session/query/ListMySessionInvitationsQuery";

/**
 * Vue (lecture) d'une invitation de session en attente, du point de vue du joueur convié.
 *
 * Porte de quoi afficher l'invitation **et** enclencher l'acceptation côté front : le `groupId`
 * permet d'activer le bon groupe de travail avant de rejoindre le lobby.
 */
export interface SessionInvitationView {
  /** Identifiant de la session concernée. */
  readonly sessionId: string;
  /** Titre de la session. */
  readonly title: string;
  /** Date de la session (ISO `YYYY-MM-DD`). */
  readonly date: string;
  /** Identifiant de la campagne parente. */
  readonly campaignId: string;
  /** Nom de la campagne parente (pour l'affichage). */
  readonly campaignName: string;
  /** Identifiant du groupe de la campagne (à activer à l'acceptation). */
  readonly groupId: string;
}

/**
 * Port « in » du use case « lister mes invitations de session en attente ».
 */
export interface ListMySessionInvitationsUseCase {
  /**
   * @param query - Le demandeur (issu de la session authentifiée).
   * @returns La liste de ses invitations en attente (sessions en `LOBBY` où il est `INVITED`).
   */
  execute(query: ListMySessionInvitationsQuery): Promise<Result<SessionInvitationView[], AppError>>;
}
