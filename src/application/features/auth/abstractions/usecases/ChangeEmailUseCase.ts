import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ChangeEmailCommand } from "@application/features/auth/commands/ChangeEmailCommand";

/**
 * Port d'entrée du use case de changement d'e-mail du compte connecté.
 */
export interface ChangeEmailUseCase {
  /**
   * Modifie l'adresse e-mail du compte authentifié.
   *
   * @param command - L'identifiant de l'utilisateur et le nouvel e-mail désiré.
   * @returns `void` en cas de succès, ou l'une des erreurs suivantes :
   *   - `INVALID_EMAIL` si le format du nouvel e-mail est invalide,
   *   - `EMAIL_ALREADY_USED` si l'adresse est déjà prise par un autre compte,
   *   - `USER_NOT_FOUND` si aucun credential n'est trouvé pour cet utilisateur.
   */
  execute(command: ChangeEmailCommand): Promise<Result<void, AppError>>;
}
