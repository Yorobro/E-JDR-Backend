import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListMyCampaignsQuery } from "@application/features/campaign/query/ListMyCampaignsQuery";

/**
 * Représentation publique (lecture) d'une campagne dans une liste.
 */
export interface CampaignSummary {
  /** Identifiant de la campagne. */
  readonly id: string;
  /** Nom (normalisé) de la campagne. */
  readonly name: string;
  /** Identifiant du maître du jeu propriétaire (permet au front d'exclure ses propres campagnes). */
  readonly gameMasterId: string;
  /** Date de création de la campagne. */
  readonly createdAt: Date;
}

/**
 * Port « in » du use case « lister mes campagnes ».
 *
 * Lecture pure : retourne les campagnes dont l'utilisateur est le maître du jeu.
 */
export interface ListMyCampaignsUseCase {
  /**
   * Liste les campagnes du maître du jeu donné.
   *
   * @param query - La requête portant l'identifiant du MJ.
   * @returns Un `Result` de succès contenant la liste (éventuellement vide).
   */
  execute(query: ListMyCampaignsQuery): Promise<Result<CampaignSummary[], AppError>>;
}
