import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une chaîne ne respecte pas les règles d'un pseudo valide
 * (vide après normalisation, ou trop long). Émise par le value object {@link Pseudo}.
 */
export class InvalidPseudoError extends DomainError {
  constructor(reason: string) {
    super("INVALID_PSEUDO", `Le pseudo fourni est invalide : ${reason}.`);
  }
}
