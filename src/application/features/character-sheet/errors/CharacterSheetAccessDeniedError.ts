import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un utilisateur tente une opération sur une fiche dont
 * il n'est pas autorisé (ex : supprimer ou rattacher la fiche d'autrui).
 *
 * Traduite en `403 Forbidden` par la couche présentation.
 */
export class CharacterSheetAccessDeniedError extends AppError {
  constructor() {
    super(
      "CHARACTER_SHEET_ACCESS_DENIED",
      "Vous n'êtes pas autorisé à effectuer cette action sur cette fiche.",
    );
  }
}
