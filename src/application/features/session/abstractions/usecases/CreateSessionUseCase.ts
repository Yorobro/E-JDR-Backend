import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CreateSessionCommand } from "@application/features/session/commands/CreateSessionCommand";
import { SessionView } from "@application/features/session/abstractions/usecases/GetSessionUseCase";

/**
 * Port « in » du use case de création de session.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète), ce qui
 * respecte l'inversion de dépendance et facilite le mock dans les tests.
 */
export interface CreateSessionUseCase {
  /**
   * Crée une nouvelle session dans une campagne dont le demandeur est le maître du jeu.
   *
   * @param command - Les données de création (campagne + MJ + titre + date).
   * @returns Un `Result` de succès (session créée) ou d'échec métier
   *          ({@link InvalidInputError}, {@link CampaignNotFoundError},
   *          {@link CampaignAccessDeniedError}).
   */
  execute(command: CreateSessionCommand): Promise<Result<SessionView, AppError>>;
}
