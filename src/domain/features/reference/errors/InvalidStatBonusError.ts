import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un **bonus de statistique** (porté par une formation ou un peuple)
 * ne respecte pas les règles métier : statistique hors de la liste autorisée, ou montant qui
 * n'est pas un entier supérieur ou égal à 1.
 *
 * Émise par le value object {@link StatBonus} lors de sa construction.
 */
export class InvalidStatBonusError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_STAT_BONUS", `Le bonus de statistique est invalide : ${reason}.`);
  }
}
