import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un titre de session ne respecte pas les règles métier
 * (vide après normalisation, ou trop long).
 *
 * Émise par le value object {@link SessionTitle} lors de sa construction.
 */
export class InvalidSessionTitleError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_SESSION_TITLE", `Le titre de la session est invalide : ${reason}.`);
  }
}
