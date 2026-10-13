import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative levée lorsqu'un joueur sélectionné pour le lobby n'appartient pas au
 * groupe de la campagne. La sélection ne peut contenir que des membres du groupe.
 */
export class ParticipantNotInGroupError extends AppError {
  /**
   * @param userId - L'identifiant du joueur fautif (non membre du groupe).
   */
  constructor(userId: string) {
    super(
      "PARTICIPANT_NOT_IN_GROUP",
      `Le joueur « ${userId} » n'est pas membre du groupe de la campagne.`,
    );
  }
}
