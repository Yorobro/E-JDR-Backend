import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CreateCampaignCommand } from "@application/features/campaign/commands/CreateCampaignCommand";

/**
 * Résultat de succès d'une création de campagne : les informations publiques de la campagne créée.
 */
export interface CreateCampaignResult {
  /** Identifiant de la nouvelle campagne. */
  readonly id: string;
  /** Nom (normalisé) de la campagne. */
  readonly name: string;
  /** Date de création de la campagne. */
  readonly createdAt: Date;
}

/**
 * Port « in » du use case de création de campagne.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète), ce qui
 * respecte l'inversion de dépendance et facilite le mock dans les tests.
 */
export interface CreateCampaignUseCase {
  /**
   * Crée une nouvelle campagne dont l'utilisateur fourni est le maître du jeu.
   *
   * @param command - Les données de création (MJ + nom brut).
   * @returns Un `Result` de succès (campagne créée) ou d'échec métier
   *          (ex : {@link InvalidInputError} si le nom est invalide).
   */
  execute(command: CreateCampaignCommand): Promise<Result<CreateCampaignResult, AppError>>;
}
