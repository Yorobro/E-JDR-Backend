import { DomainError } from "@domain/shared/errors/DomainError";

/** Erreur domaine levée lorsqu'un sexe n'est pas l'un de M/F/NB. Émise par {@link Sex}. */
export class InvalidSexError extends DomainError {
  constructor(reason: string) {
    super("INVALID_SEX", `Le sexe est invalide : ${reason}.`);
  }
}
