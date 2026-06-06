import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lors du rafraîchissement lorsque le refresh token est
 * absent, expiré, mal signé, ou introuvable/révoqué en base de données.
 *
 * Traduite en `401 Unauthorized` par la couche présentation.
 */
export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super("INVALID_REFRESH_TOKEN", "Le jeton de rafraîchissement est invalide ou expiré.");
  }
}
