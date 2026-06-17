import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListCampaignSessionsQuery } from "@application/features/session/query/ListCampaignSessionsQuery";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Port « in » du use case « lister les sessions d'une campagne ».
 *
 * Lecture (avec contrôle d'accès) : retourne les sessions de la campagne si le demandeur en
 * est le maître du jeu.
 */
export interface ListCampaignSessionsUseCase {
  /**
   * Liste les sessions d'une campagne dont le demandeur est le maître du jeu.
   *
   * @param query - La requête portant l'identifiant de la campagne et du demandeur.
   * @returns Un `Result` de succès contenant la liste (éventuellement vide), ou d'échec métier
   *          ({@link CampaignNotFoundError} / {@link CampaignAccessDeniedError}).
   */
  execute(query: ListCampaignSessionsQuery): Promise<Result<SessionView[], AppError>>;
}
