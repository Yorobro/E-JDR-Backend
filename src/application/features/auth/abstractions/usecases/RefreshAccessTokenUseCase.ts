import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { RefreshAccessTokenCommand } from "@application/features/auth/commands/RefreshAccessTokenCommand";
import { AccessTokenOnly } from "@application/features/auth/abstractions/services/AuthTokenService";

/**
 * Résultat de succès d'un rafraîchissement : un nouvel access token.
 *
 * Le refresh token de la session n'est **pas** régénéré : le client conserve celui qu'il
 * détient déjà. Ce choix (pas de rotation) permet à plusieurs appareils du même utilisateur
 * de rester connectés simultanément.
 */
export interface RefreshAccessTokenResult {
  /** Le nouvel access token émis (et sa date d'expiration). */
  readonly accessToken: AccessTokenOnly;
}

/**
 * Port « in » du use case de rafraîchissement des jetons.
 *
 * Le controller dépend de cette interface, ce qui respecte l'inversion de dépendance
 * et facilite le mock dans les tests.
 */
export interface RefreshAccessTokenUseCase {
  /**
   * Émet un nouvel access token à partir d'un refresh token valide, **sans** révoquer ni
   * faire tourner le refresh token (la session de l'appareil reste intacte).
   *
   * @param command - Le refresh token courant.
   * @returns Un `Result` de succès (nouvel access token) ou d'échec métier
   *          (ex : {@link InvalidRefreshTokenError}).
   */
  execute(command: RefreshAccessTokenCommand): Promise<Result<RefreshAccessTokenResult, AppError>>;
}
