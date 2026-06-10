import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lors de l'inscription lorsqu'un compte existe déjà
 * pour l'adresse e-mail fournie.
 *
 * Traduite en `409 Conflict` par la couche présentation.
 */
export class EmailAlreadyUsedError extends AppError {
  constructor() {
    super("EMAIL_ALREADY_USED", "Un compte existe déjà avec cette adresse e-mail.");
  }
}

