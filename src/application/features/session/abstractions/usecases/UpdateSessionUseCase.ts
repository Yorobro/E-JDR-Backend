import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UpdateSessionCommand } from "@application/features/session/commands/UpdateSessionCommand";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Port « in » du use case de mise à jour de session.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète).
 */
export interface UpdateSessionUseCase {
  /**
   * Met à jour le titre et la date d'une session si le demandeur est le maître du jeu de la
   * campagne parente.
   *
   * @param command - Identifiant de la session + demandeur + nouveaux titre/date.
   * @returns Un `Result` de succès (session mise à jour) ou d'échec métier
   *          ({@link InvalidInputError}, {@link SessionNotFoundError},
   *          {@link SessionAccessDeniedError}).
   */
  execute(command: UpdateSessionCommand): Promise<Result<SessionView, AppError>>;
}
