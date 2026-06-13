import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un utilisateur tente une opération sur une campagne
 * dont il n'est pas le maître du jeu (ex : suppression d'une campagne d'autrui).
 *
 * Traduite en `403 Forbidden` par la couche présentation.
 */
export class CampaignAccessDeniedError extends AppError {
  constructor() {
    super("CAMPAIGN_ACCESS_DENIED", "Vous n'êtes pas autorisé à modifier cette campagne.");
  }
}
