import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { RegisterUserCommand } from "@application/features/auth/commands/RegisterUserCommand";
import { AuthTokens } from "@application/features/auth/abstractions/services/AuthTokenService";

/**
 * Résultat de succès d'une inscription : l'utilisateur créé est connecté directement,
 * on renvoie donc ses informations publiques et la paire de jetons émise.
 */
export interface RegisterUserResult {
  /** Identifiant du nouvel utilisateur. */
  readonly userId: string;
  /** Adresse e-mail (normalisée) du nouvel utilisateur. */
  readonly email: string;
  /** Paire de jetons d'authentification émise lors de l'inscription. */
  readonly tokens: AuthTokens;
}

/**
 * Port « in » du use case d'inscription.
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète), ce qui
 * respecte l'inversion de dépendance et facilite le mock dans les tests.
 */
export interface RegisterUserUseCase {
  /**
   * Inscrit un nouvel utilisateur puis le connecte directement.
   *
   * @param command - Les données d'inscription (e-mail, mot de passe).
   * @returns Un `Result` de succès (utilisateur + jetons) ou d'échec métier
   *          (ex : {@link EmailAlreadyUsedError}).
   */
  execute(command: RegisterUserCommand): Promise<Result<RegisterUserResult, AppError>>;
}
