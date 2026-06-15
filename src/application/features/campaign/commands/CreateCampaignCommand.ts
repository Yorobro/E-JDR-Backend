/**
 * Commande d'entrée du use case de création de campagne.
 *
 * Transporte les données brutes nécessaires. Le `gameMasterId` provient de l'utilisateur
 * authentifié (jamais du corps de la requête) ; le `name` est validé par le value object
 * `CampaignName` du domaine au sein du use case.
 */
export interface CreateCampaignCommand {
  /** Identifiant du maître du jeu propriétaire (issu de la session authentifiée). */
  readonly gameMasterId: string;
  /** Nom de la campagne saisi par l'utilisateur (brut, non encore validé). */
  readonly name: string;
}
