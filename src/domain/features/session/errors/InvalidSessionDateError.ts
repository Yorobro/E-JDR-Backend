import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une date de session ne respecte pas le format métier attendu
 * (`YYYY-MM-DD`) ou ne désigne pas une date calendaire réelle.
 *
 * Émise par le value object {@link SessionDate} lors de sa construction.
 */
export class InvalidSessionDateError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_SESSION_DATE", `La date de la session est invalide : ${reason}.`);
  }
}
