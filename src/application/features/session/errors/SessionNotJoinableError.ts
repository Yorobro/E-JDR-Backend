import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un joueur tente de répondre à une invitation alors que la
 * session n'est pas (ou plus) en salon d'attente : on ne répond qu'à un lobby ouvert (`LOBBY`),
 * ni avant (`PLANNED`), ni après le démarrage (`ACTIVE` / `ENDED`).
 *
 * Conflit d'état → `409 Conflict`.
 */
export class SessionNotJoinableError extends AppError {
  /**
   * @param currentStatus - Le statut courant de la session (pour le message).
   */
  constructor(currentStatus: string) {
    super(
      "SESSION_NOT_JOINABLE",
      `Impossible de répondre : la session n'est pas en salon d'attente (statut « ${currentStatus} »).`,
    );
  }
}
