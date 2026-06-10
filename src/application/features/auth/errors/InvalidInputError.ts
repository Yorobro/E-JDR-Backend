import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative levée quand une entrée viole un invariant du domaine (e-mail mal formé,
 * mot de passe trop faible…). Elle transporte le code et le message de la `DomainError`
 * d'origine afin que la présentation puisse les relayer sans connaître le domaine.
 */
export class InvalidInputError extends AppError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}


