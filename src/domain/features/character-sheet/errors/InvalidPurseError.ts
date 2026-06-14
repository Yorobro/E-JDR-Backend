import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une bourse (or/argent/cuivre) viole ses règles
 * (valeur négative ou non entière). Émise par {@link Purse} lors de sa construction.
 */
export class InvalidPurseError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité.
   */
  constructor(reason: string) {
    super("INVALID_PURSE", `La bourse est invalide : ${reason}.`);
  }
}
