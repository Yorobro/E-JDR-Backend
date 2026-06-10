import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LoginUserCommand } from "@application/features/auth/commands/LoginUserCommand";
import { AuthTokens } from "@application/features/auth/abstractions/services/IAuthTokenService";

/**
 * Résultat de succès d'une connexion : informations publiques de l'utilisateur
 * et paire de jetons émise.
 */
export interface LoginUserResult {
  /** Identifiant de l'utilisateur connecté. */
  readonly userId: string;
  /** Adresse e-mail (normalisée) de l'utilisateur connecté. */
  readonly email: string;
  /** Paire de jetons d'authentification émise lors de la connexion. */
  readonly tokens: AuthTokens;
}

/**
 * Port « in » du use case de connexion.
 *
 * Le controller dépend de cette interface, ce qui respecte l'inversion de dépendance
 * et facilite le mock dans les tests.
 */
export interface ILoginUserUseCase {
  /**
   * Authentifie un utilisateur à partir de ses identifiants.
   *
   * @param command - Les identifiants (e-mail, mot de passe).
   * @returns Un `Result` de succès (utilisateur + jetons) ou d'échec métier
   *          (ex : {@link InvalidCredentialsError}).
   */
  execute(command: LoginUserCommand): Promise<Result<LoginUserResult, AppError>>;
}


