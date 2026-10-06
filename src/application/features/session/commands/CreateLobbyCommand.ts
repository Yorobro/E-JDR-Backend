/**
 * Commande d'entrée du use case « ouvrir le lobby d'une session ».
 *
 * Déclenchée quand le MJ lance une session : il a coché les joueurs à inviter, puis cliqué
 * sur « démarrer ». L'`actorUserId` provient de l'utilisateur authentifié (jamais du corps) ;
 * il sert à vérifier que le demandeur est éditeur (MJ/admin) du groupe de la campagne parente.
 */
export interface CreateLobbyCommand {
  /** Identifiant de la session à passer en lobby (issu de l'URL). */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
  /**
   * Identifiants des joueurs à inviter (cochés dans l'interface). Doivent être membres du
   * groupe de la campagne. Les doublons éventuels sont ignorés par le use case.
   */
  readonly participantUserIds: string[];
}
