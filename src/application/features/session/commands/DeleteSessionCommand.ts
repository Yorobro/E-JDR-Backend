/**
 * Commande d'entrée du use case de suppression de session.
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur
 * est le maître du jeu de la campagne parente avant toute suppression.
 */
export interface DeleteSessionCommand {
  /** Identifiant de la session à supprimer. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
