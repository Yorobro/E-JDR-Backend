import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une valeur ne correspond à aucun statut de participation connu
 * (`INVITED`, `ACCEPTED`, `REFUSED`).
 *
 * Émise par le value object {@link SessionParticipantStatus} lors de sa reconstruction.
 */
export class InvalidSessionParticipantStatusError extends DomainError {
  /**
   * @param raw - La valeur invalide rencontrée (incluse dans le message de diagnostic).
   */
  constructor(raw: string) {
    super("INVALID_SESSION_PARTICIPANT_STATUS", `Statut de participation inconnu : « ${raw} ».`);
  }
}
