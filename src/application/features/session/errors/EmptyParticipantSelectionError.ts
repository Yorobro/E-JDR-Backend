import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative levée lorsqu'on tente d'ouvrir un lobby sans avoir sélectionné le moindre
 * joueur. Le MJ doit choisir au moins un participant.
 */
export class EmptyParticipantSelectionError extends AppError {
  constructor() {
    super(
      "EMPTY_PARTICIPANT_SELECTION",
      "Au moins un joueur doit être sélectionné pour ouvrir le lobby.",
    );
  }
}
