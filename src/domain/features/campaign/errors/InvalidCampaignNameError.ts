import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un nom de campagne ne respecte pas les règles métier
 * (vide après normalisation, ou trop long).
 *
 * Émise par le value object {@link CampaignName} lors de sa construction.
 */
export class InvalidCampaignNameError extends DomainError {
  /**
   * @param reason - La raison précise de l'invalidité (incluse dans le message de diagnostic).
   */
  constructor(reason: string) {
    super("INVALID_CAMPAIGN_NAME", `Le nom de la campagne est invalide : ${reason}.`);
  }
}
