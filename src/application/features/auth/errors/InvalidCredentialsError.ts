import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lors de la connexion lorsque l'e-mail est inconnu
 * **ou** que le mot de passe est incorrect.
 *
 * Le message est volontairement identique dans les deux cas afin de ne pas révéler
 * l'existence (ou non) d'un compte — protection contre l'énumération d'utilisateurs.
 *
 * Traduite en `401 Unauthorized` par la couche présentation.
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("INVALID_CREDENTIALS", "Adresse e-mail ou mot de passe incorrect.");
  }
}

