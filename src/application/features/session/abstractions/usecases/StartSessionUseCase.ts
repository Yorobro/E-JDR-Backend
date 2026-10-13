import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { StartSessionCommand } from "@application/features/session/commands/StartSessionCommand";

/**
 * Port « in » du use case « démarrer réellement la session » (côté MJ).
 *
 * Fait passer la session de `LOBBY` à `ACTIVE` et horodate son démarrage. La transition et
 * l'invariant « on ne démarre que depuis LOBBY » sont portés par l'entité `Session`, pas ici ;
 * l'autorisation (MJ de la campagne parente) est vérifiée dans l'implémentation.
 */
export interface StartSessionUseCase {
  /**
   * @param command - Session ciblée + demandeur (depuis la session authentifiée).
   * @returns Un `Result` de succès (`void`) ou d'échec métier
   *          ({@link SessionNotFoundError}, {@link CampaignNotFoundError},
   *          {@link NotGroupEditorError}, ou `SESSION_NOT_STARTABLE` si la session n'est pas
   *          au statut `LOBBY`).
   */
  execute(command: StartSessionCommand): Promise<Result<void, AppError>>;
}
