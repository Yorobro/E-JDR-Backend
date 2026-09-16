/**
 * Commande du use case « le MJ démarre réellement la session » (transition `LOBBY → ACTIVE`).
 *
 * `actorUserId` provient de la session authentifiée (jamais du corps) : seul le MJ de la campagne
 * parente peut démarrer la partie, une fois qu'il a vérifié que tous les joueurs sont présents.
 */
export interface StartSessionCommand {
  /** Identifiant de la session à démarrer. */
  readonly sessionId: string;
  /** Identifiant du demandeur (doit être le MJ de la campagne parente). */
  readonly actorUserId: string;
}
