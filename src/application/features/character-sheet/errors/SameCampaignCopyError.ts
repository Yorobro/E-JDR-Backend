import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'on tente de copier une fiche vers la **même** campagne
 * que celle à laquelle elle est déjà rattachée. Une copie doit viser une autre campagne.
 *
 * Traduite en `409 Conflict` par la couche présentation.
 */
export class SameCampaignCopyError extends AppError {
  constructor() {
    super(
      "SAME_CAMPAIGN_COPY",
      "Impossible de copier une fiche vers sa propre campagne : choisissez une autre campagne.",
    );
  }
}
