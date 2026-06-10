import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une empreinte de mot de passe est vide ou absente.
 *
 * Indique une anomalie de persistance (ligne corrompue en base) plutôt qu'une
 * violation métier de l'utilisateur.
 */
export class InvalidHashError extends DomainError {
  constructor() {
    super("INVALID_HASH", "L'empreinte du mot de passe est invalide ou absente.");
  }
}

