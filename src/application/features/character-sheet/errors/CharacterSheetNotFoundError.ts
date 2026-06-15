import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'aucune fiche ne correspond à l'identifiant fourni.
 *
 * Traduite en `404 Not Found` par la couche présentation.
 */
export class CharacterSheetNotFoundError extends AppError {
  constructor() {
    super("CHARACTER_SHEET_NOT_FOUND", "Fiche de personnage introuvable.");
  }
}
