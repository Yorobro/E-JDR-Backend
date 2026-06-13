import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un maître du jeu tente de rattacher l'une de ses propres
 * fiches à sa propre campagne. Règle métier : le MJ ne peut pas être joueur de sa campagne.
 *
 * Traduite en `409 Conflict` par la couche présentation.
 */
export class GameMasterCannotJoinOwnCampaignError extends AppError {
  constructor() {
    super(
      "GM_CANNOT_JOIN_OWN_CAMPAIGN",
      "Le maître du jeu ne peut pas ajouter une de ses fiches à sa propre campagne.",
    );
  }
}
