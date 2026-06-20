import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";

/**
 * Exécute la fabrique d'un value object (`X.create(...)`) et convertit une éventuelle
 * `DomainError` de validation en `InvalidInputError` (→ 400), en **préservant le code et le
 * message** d'origine. Toute autre exception (bug technique) est **re-levée** pour ne jamais
 * être avalée silencieusement (→ 500 via le gestionnaire d'erreurs global).
 *
 * Remplace le bloc `try/catch (e instanceof DomainError)` dupliqué dans de nombreux use cases,
 * et garantit qu'une entrée invalide (e-mail mal formé, rôle inconnu…) renvoie un 400 explicite
 * plutôt qu'un code métier trompeur (404/403) ou un 500.
 *
 * @example
 * const emailResult = tryCreateValueObject(() => Email.create(command.email));
 * if (emailResult.isFailure) return Result.failure(emailResult.error);
 * const email = emailResult.value;
 */
export function tryCreateValueObject<T>(create: () => T): Result<T, InvalidInputError> {
  try {
    return Result.success(create());
  } catch (error) {
    if (error instanceof DomainError) {
      return Result.failure(new InvalidInputError(error.code, error.message));
    }
    throw error;
  }
}
