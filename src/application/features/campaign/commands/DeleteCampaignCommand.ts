/**
 * Commande d'entrée du use case de suppression de campagne.
 *
 * Le `gameMasterId` provient de l'utilisateur authentifié : il sert à vérifier que le
 * demandeur est bien le maître du jeu propriétaire avant toute suppression.
 */
export interface DeleteCampaignCommand {
  /** Identifiant de la campagne à supprimer. */
  readonly campaignId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly gameMasterId: string;
}
