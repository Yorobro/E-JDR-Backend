import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LogoutUserCommand } from "@application/features/auth/commands/LogoutUserCommand";

/**
 * Port « in » du use case de déconnexion.
 *
 * Le controller dépend de cette interface, ce qui respecte l'inversion de dépendance
 * et facilite le mock dans les tests.
 */
export interface ILogoutUserUseCase {
  /**
   * Déconnecte l'utilisateur en révoquant son refresh token côté serveur.
   *
   * La déconnexion est idempotente : révoquer un token déjà absent est considéré comme
   * un succès (l'objectif « ce token ne doit plus être valide » est atteint).
   *
   * @param command - Le refresh token à révoquer.
   * @returns Un `Result` de succès (`void`) ou d'échec métier.
   */
  execute(command: LogoutUserCommand): Promise<Result<void, AppError>>;
}

