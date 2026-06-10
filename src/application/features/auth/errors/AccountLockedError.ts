import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative levée lorsqu'un compte est temporairement verrouillé
 * suite à trop de tentatives de connexion échouées.
 */
export class AccountLockedError extends AppError {
  constructor(lockedUntil: Date) {
    super(
      "ACCOUNT_LOCKED",
      `Compte temporairement verrouillé jusqu'au ${lockedUntil.toISOString()}.`,
    );
  }
}

