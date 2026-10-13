import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'on tente de démarrer une session qui n'est pas au statut
 * `LOBBY` (on ne peut commencer la partie qu'une fois le lobby ouvert).
 *
 * Émise par {@link Session.start}.
 */
export class SessionNotStartableError extends DomainError {
  /**
   * @param currentStatus - Le statut courant de la session (qui empêche le démarrage).
   */
  constructor(currentStatus: string) {
    super(
      "SESSION_NOT_STARTABLE",
      `Impossible de démarrer la session : elle doit être au statut LOBBY ` +
        `(statut actuel : ${currentStatus}).`,
    );
  }
}
