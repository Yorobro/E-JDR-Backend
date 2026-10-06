import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { GetSessionLobbyQuery } from "@application/features/session/query/GetSessionLobbyQuery";

/**
 * Port « in » du use case « obtenir le lobby d'une session » (statut + participants).
 *
 * Utilisé par le MJ (reprise à froid) comme par un joueur convié qui rejoint le salon d'attente.
 * Réutilise la même vue {@link SessionLobbyView} que l'ouverture du lobby.
 */
export interface GetSessionLobbyUseCase {
  /**
   * @param query - Session ciblée + demandeur (issu de la session authentifiée).
   * @returns Le lobby (session + participants), ou un échec métier
   *          ({@link SessionNotFoundError}, `NOT_GROUP_MEMBER`).
   */
  execute(query: GetSessionLobbyQuery): Promise<Result<SessionLobbyView, AppError>>;
}
