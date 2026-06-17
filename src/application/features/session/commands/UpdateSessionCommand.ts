/**
 * Commande d'entrée du use case de mise à jour de session.
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur
 * est le maître du jeu de la campagne parente avant toute modification.
 */
export interface UpdateSessionCommand {
  /** Identifiant de la session à mettre à jour. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
  /** Nouveau titre de la session (brut, non encore validé). */
  readonly title: string;
  /** Nouvelle date de la session au format `YYYY-MM-DD` (brute, parsée par le use case). */
  readonly date: string;
}
