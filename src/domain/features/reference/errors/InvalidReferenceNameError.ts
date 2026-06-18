import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un nom d'élément de référence (formation, peuple, arme, armure,
 * compétence, équipement) ne respecte pas les règles métier (vide après normalisation, trop long).
 *
 * Émise par le value object {@link ReferenceName} lors de sa construction.
 */
export class InvalidReferenceNameError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_REFERENCE_NAME", `Le nom de l'élément de référence est invalide : ${reason}.`);
  }
}
