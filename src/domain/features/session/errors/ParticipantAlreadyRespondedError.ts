import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un joueur tente d'accepter ou de refuser une invitation à
 * laquelle il a **déjà répondu** (statut différent de `INVITED`).
 *
 * Émise par {@link SessionParticipant.accept} et {@link SessionParticipant.refuse}.
 */
export class ParticipantAlreadyRespondedError extends DomainError {
  /**
   * @param currentStatus - Le statut courant de la participation (déjà `ACCEPTED` ou `REFUSED`).
   */
  constructor(currentStatus: string) {
    super(
      "PARTICIPANT_ALREADY_RESPONDED",
      `Le joueur a déjà répondu à cette invitation (statut actuel : ${currentStatus}).`,
    );
  }
}
