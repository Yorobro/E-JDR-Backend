import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { DeleteCampaignCommand } from "@application/features/campaign/commands/DeleteCampaignCommand";

/**
 * Port « in » du use case de suppression de campagne.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète).
 */
export interface DeleteCampaignUseCase {
  /**
   * Supprime une campagne si le demandeur en est le maître du jeu.
   *
   * @param command - Identifiant de la campagne + identifiant du demandeur.
   * @returns Un `Result` de succès, ou d'échec métier
   *          ({@link CampaignNotFoundError} / {@link CampaignAccessDeniedError}).
   */
  execute(command: DeleteCampaignCommand): Promise<Result<void, AppError>>;
}
