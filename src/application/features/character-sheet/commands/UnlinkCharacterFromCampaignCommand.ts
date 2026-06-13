/**
 * Commande d'entrée du use case de détachement d'une fiche d'une campagne.
 *
 * `actorUserId` provient de l'utilisateur authentifié : le détachement est autorisé soit au
 * maître du jeu de la campagne, soit au propriétaire de la fiche.
 */
export interface UnlinkCharacterFromCampaignCommand {
  /** Identifiant de la campagne. */
  readonly campaignId: string;
  /** Identifiant de la fiche à détacher. */
  readonly characterSheetId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
