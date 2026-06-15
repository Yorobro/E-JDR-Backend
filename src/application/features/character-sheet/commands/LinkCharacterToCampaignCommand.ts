/**
 * Commande d'entrée du use case de rattachement d'une fiche à une campagne.
 *
 * `actorUserId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur
 * est bien le propriétaire de la fiche rattachée.
 */
export interface LinkCharacterToCampaignCommand {
  /** Identifiant de la campagne cible. */
  readonly campaignId: string;
  /** Identifiant de la fiche à rattacher. */
  readonly characterSheetId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
