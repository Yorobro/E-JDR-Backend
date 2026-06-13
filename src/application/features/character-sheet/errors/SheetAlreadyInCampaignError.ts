import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'une fiche est déjà rattachée à la campagne ciblée.
 *
 * Traduite en `409 Conflict` par la couche présentation.
 */
export class SheetAlreadyInCampaignError extends AppError {
  constructor() {
    super("SHEET_ALREADY_IN_CAMPAIGN", "Cette fiche est déjà rattachée à cette campagne.");
  }
}
