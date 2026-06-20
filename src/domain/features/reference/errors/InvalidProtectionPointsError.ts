import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un nombre de points de protection fourni n'est pas un nombre
 * fini (ex : `NaN` issu d'un cast d'une valeur non numérique à la frontière HTTP).
 *
 * Émise par {@link ReferenceItem} lors de la normalisation des points de protection.
 */
export class InvalidProtectionPointsError extends DomainError {
  constructor(value: unknown) {
    super(
      "INVALID_PROTECTION_POINTS",
      `Les points de protection doivent être un nombre entier : "${String(value)}".`,
    );
  }
}
