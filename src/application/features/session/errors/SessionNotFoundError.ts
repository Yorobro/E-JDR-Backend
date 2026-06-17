import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'aucune session ne correspond à l'identifiant fourni.
 *
 * Traduite en `404 Not Found` par la couche présentation.
 */
export class SessionNotFoundError extends AppError {
  constructor() {
    super("SESSION_NOT_FOUND", "Session introuvable.");
  }
}
