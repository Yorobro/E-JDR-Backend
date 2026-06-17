/**
 * Requête de lecture du use case « obtenir une session ».
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : on ne retourne la session que si le
 * demandeur est le maître du jeu de la campagne parente.
 */
export interface GetSessionQuery {
  /** Identifiant de la session demandée. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
