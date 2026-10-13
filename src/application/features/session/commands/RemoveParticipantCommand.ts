/**
 * Commande d'entrée du use case « retirer un joueur d'un salon d'attente ».
 *
 * Déclenchée depuis le lobby quand le MJ écarte un joueur (erreur de sélection, joueur absent).
 * L'`actorUserId` provient de l'utilisateur authentifié (jamais du corps) ; il sert à vérifier
 * que le demandeur est éditeur (MJ/admin) du groupe de la campagne parente.
 */
export interface RemoveParticipantCommand {
  /** Identifiant de la session dont le lobby est ouvert (issu de l'URL). */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
  /** Identifiant du joueur à retirer du lobby (issu de l'URL). */
  readonly participantUserId: string;
}
