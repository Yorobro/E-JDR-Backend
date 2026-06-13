import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'aucune campagne ne correspond à l'identifiant fourni.
 *
 * Traduite en `404 Not Found` par la couche présentation.
 */
export class CampaignNotFoundError extends AppError {
  constructor() {
    super("CAMPAIGN_NOT_FOUND", "Campagne introuvable.");
  }
}
