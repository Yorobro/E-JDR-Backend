import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'aucun élément de référence ne correspond à l'identifiant
 * fourni (ou qu'il n'appartient pas au demandeur — même réponse pour ne pas révéler l'existence).
 *
 * Traduite en `404 Not Found` par la couche présentation.
 */
export class ReferenceItemNotFoundError extends AppError {
  constructor() {
    super("REFERENCE_ITEM_NOT_FOUND", "Élément de référence introuvable.");
  }
}
