/**
 * Requête de lecture du use case « lister les sessions d'une campagne ».
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : on ne liste les sessions que si le
 * demandeur est le maître du jeu de la campagne parente.
 */
export interface ListCampaignSessionsQuery {
  /** Identifiant de la campagne dont on veut les sessions (issu de l'URL). */
  readonly campaignId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
