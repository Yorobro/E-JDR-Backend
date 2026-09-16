import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un joueur tente de répondre à une invitation qui n'existe
 * pas : aucune participation ne le relie à cette session (il n'a pas été convié).
 *
 * Traduite en `404 Not Found` par la couche présentation.
 */
export class ParticipantNotFoundError extends AppError {
  constructor() {
    super("PARTICIPANT_NOT_FOUND", "Aucune invitation ne vous relie à cette session.");
  }
}
