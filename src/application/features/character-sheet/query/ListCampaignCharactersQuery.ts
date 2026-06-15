/**
 * Requête de lecture du use case « lister les fiches d'une campagne ».
 *
 * `actorUserId` provient de l'utilisateur authentifié.
 */
export interface ListCampaignCharactersQuery {
  /** Identifiant de la campagne dont on veut les fiches rattachées. */
  readonly campaignId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
