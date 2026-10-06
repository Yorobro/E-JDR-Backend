import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'on tente d'ouvrir le lobby d'une session qui n'est pas au
 * statut `PLANNED` (par exemple une session déjà en `LOBBY`, `ACTIVE` ou `ENDED`).
 *
 * Émise par {@link Session.openLobby}.
 */
export class SessionNotLaunchableError extends DomainError {
  /**
   * @param currentStatus - Le statut courant de la session (qui empêche l'ouverture du lobby).
   */
  constructor(currentStatus: string) {
    super(
      "SESSION_NOT_LAUNCHABLE",
      `Impossible d'ouvrir le lobby : la session doit être au statut PLANNED ` +
        `(statut actuel : ${currentStatus}).`,
    );
  }
}
