import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une chaîne ne respecte pas le format d'un e-mail valide.
 *
 * Émise par le value object {@link Email} lors de sa construction.
 */
export class InvalidEmailError extends DomainError {
  /**
   * @param value - La valeur fautive (incluse dans le message à des fins de diagnostic).
   */
  constructor(value: string) {
    super("INVALID_EMAIL", `L'adresse e-mail fournie est invalide : "${value}".`);
  }
}
