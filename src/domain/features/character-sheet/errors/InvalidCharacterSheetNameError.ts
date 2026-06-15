import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un nom de fiche de personnage ne respecte pas les règles métier
 * (vide après normalisation, ou trop long).
 *
 * Émise par le value object {@link CharacterSheetName} lors de sa construction.
 */
export class InvalidCharacterSheetNameError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_CHARACTER_SHEET_NAME", `Le nom de la fiche est invalide : ${reason}.`);
  }
}
