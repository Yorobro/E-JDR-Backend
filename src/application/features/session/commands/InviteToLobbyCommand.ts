/**
 * Commande d'entrée du use case « convier des joueurs à un lobby déjà ouvert ».
 *
 * Déclenchée depuis le salon d'attente quand le MJ ajoute un joueur oublié, ou reconvie un
 * joueur ayant refusé par erreur. L'`actorUserId` provient de l'utilisateur authentifié (jamais
 * du corps) ; il sert à vérifier que le demandeur est éditeur (MJ/admin) du groupe de la
 * campagne parente.
 */
export interface InviteToLobbyCommand {
  /** Identifiant de la session dont le lobby est ouvert (issu de l'URL). */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
  /**
   * Identifiants des joueurs à convier (choisis dans l'interface). Doivent être membres du
   * groupe de la campagne. Les doublons éventuels sont ignorés par le use case.
   */
  readonly participantUserIds: string[];
}
