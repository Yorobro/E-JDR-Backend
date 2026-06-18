import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un utilisateur tente de créer, dans une catégorie donnée,
 * un élément de référence dont le nom existe déjà dans son catalogue (unicité `owner_id, name`).
 *
 * Traduite en `409 Conflict` par la couche présentation.
 */
export class ReferenceNameAlreadyUsedError extends AppError {
  constructor() {
    super("REFERENCE_NAME_ALREADY_USED", "Un élément de référence porte déjà ce nom.");
  }
}
