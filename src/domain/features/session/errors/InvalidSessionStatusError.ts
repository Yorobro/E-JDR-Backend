import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une valeur ne correspond à aucun statut de session connu
 * (`PLANNED`, `LOBBY`, `ACTIVE`, `ENDED`).
 *
 * Émise par le value object {@link SessionStatus} lors de sa reconstruction.
 */
export class InvalidSessionStatusError extends DomainError {
  /**
   * @param raw - La valeur invalide rencontrée (incluse dans le message de diagnostic).
   */
  constructor(raw: string) {
    super("INVALID_SESSION_STATUS", `Statut de session inconnu : « ${raw} ».`);
  }
}
