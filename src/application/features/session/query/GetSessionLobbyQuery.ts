/**
 * Requête de lecture « obtenir le lobby d'une session ».
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : le lobby n'est retourné qu'aux membres
 * du groupe de la campagne (le MJ comme les joueurs conviés).
 */
export interface GetSessionLobbyQuery {
  /** Identifiant de la session dont on veut le lobby. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
