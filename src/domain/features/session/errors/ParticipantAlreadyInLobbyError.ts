import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'on tente de **réinviter** un joueur qui est déjà dans le salon
 * d'attente : seule une invitation `REFUSED` peut repartir à `INVITED` (cas du refus accidentel).
 * Un joueur encore `INVITED` (en attente de réponse) ou déjà `ACCEPTED` n'a rien à réinviter.
 *
 * Émise par {@link SessionParticipant.reinvite}.
 */
export class ParticipantAlreadyInLobbyError extends DomainError {
  /**
   * @param currentStatus - Le statut courant de la participation (`INVITED` ou `ACCEPTED`).
   */
  constructor(currentStatus: string) {
    super(
      "PARTICIPANT_ALREADY_IN_LOBBY",
      `Le joueur est déjà convié à cette session (statut actuel : ${currentStatus}).`,
    );
  }
}
