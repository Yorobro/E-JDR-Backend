import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { DeleteSessionCommand } from "@application/features/session/commands/DeleteSessionCommand";

/**
 * Port « in » du use case de suppression de session.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète).
 */
export interface DeleteSessionUseCase {
  /**
   * Supprime une session si le demandeur est le maître du jeu de la campagne parente.
   *
   * @param command - Identifiant de la session + identifiant du demandeur.
   * @returns Un `Result` de succès, ou d'échec métier
   *          ({@link SessionNotFoundError} / {@link SessionAccessDeniedError}).
   */
  execute(command: DeleteSessionCommand): Promise<Result<void, AppError>>;
}
