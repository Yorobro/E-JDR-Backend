/**
 * Commande du use case « un joueur convié répond à son invitation de session ».
 *
 * `actorUserId` provient de la session authentifiée (jamais du corps) : un joueur ne répond que
 * pour lui-même. La décision est binaire : `accept` rejoint le lobby (INVITED → ACCEPTED), sinon
 * l'invitation est déclinée (INVITED → REFUSED).
 */
export interface RespondToInvitationCommand {
  /** Identifiant de la session concernée. */
  readonly sessionId: string;
  /** Identifiant du joueur qui répond (doit être un participant convié). */
  readonly actorUserId: string;
  /** `true` pour accepter (ACCEPTED), `false` pour refuser (REFUSED). */
  readonly accept: boolean;
}
