import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { RefreshAccessTokenCommand } from "@application/features/auth/commands/RefreshAccessTokenCommand";
import { AuthTokens } from "@application/features/auth/abstractions/services/AuthTokenService";

/**
 * Résultat de succès d'un rafraîchissement : une nouvelle paire de jetons (rotation).
 */
export interface RefreshAccessTokenResult {
  /** Nouvelle paire de jetons d'authentification émise. */
  readonly tokens: AuthTokens;
}

/**
 * Port « in » du use case de rafraîchissement des jetons.
 *
 * Le controller dépend de cette interface, ce qui respecte l'inversion de dépendance
 * et facilite le mock dans les tests.
 */
export interface RefreshAccessTokenUseCase {
  /**
   * Émet une nouvelle paire de jetons à partir d'un refresh token valide, en révoquant
   * l'ancien (rotation des refresh tokens).
   *
   * @param command - Le refresh token courant.
   * @returns Un `Result` de succès (nouveaux jetons) ou d'échec métier
   *          (ex : {@link InvalidRefreshTokenError}).
   */
  execute(command: RefreshAccessTokenCommand): Promise<Result<RefreshAccessTokenResult, AppError>>;
}
