import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsque le MJ tente de convier un joueur supplémentaire alors que
 * le salon d'attente n'est pas (ou plus) ouvert : on n'invite que depuis un lobby `LOBBY`, ni
 * avant son ouverture (`PLANNED`), ni après le démarrage (`ACTIVE` / `ENDED`).
 *
 * Conflit d'état → `409 Conflict`.
 */
export class LobbyNotOpenError extends AppError {
  /**
   * @param currentStatus - Le statut courant de la session (pour le message).
   */
  constructor(currentStatus: string) {
    super(
      "LOBBY_NOT_OPEN",
      `Impossible d'inviter : le salon d'attente n'est pas ouvert (statut « ${currentStatus} »).`,
    );
  }
}
