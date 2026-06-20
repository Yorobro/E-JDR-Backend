import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ChangePasswordCommand } from "@application/features/auth/commands/ChangePasswordCommand";

/**
 * Port d'entrée du use case de changement de mot de passe du compte connecté.
 */
export interface ChangePasswordUseCase {
  /**
   * Modifie le mot de passe du compte authentifié.
   *
   * @param command - L'identifiant de l'utilisateur, le mot de passe actuel et le nouveau.
   * @returns `void` en cas de succès, ou l'une des erreurs suivantes :
   *   - `INVALID_CREDENTIALS` si le mot de passe actuel est incorrect,
   *   - `WEAK_PASSWORD` si le nouveau mot de passe ne respecte pas la politique de robustesse,
   *   - `USER_NOT_FOUND` si aucun credential n'est trouvé pour cet utilisateur.
   */
  execute(command: ChangePasswordCommand): Promise<Result<void, AppError>>;
}
