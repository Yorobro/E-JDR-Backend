/**
 * Requête de consultation des campagnes auxquelles une fiche est rattachée.
 *
 * Le `ownerId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur est
 * bien le propriétaire de la fiche (sinon 403), jamais à filtrer une liste.
 */
export interface GetSheetCampaignsQuery {
  /** Identifiant de la fiche dont on liste les campagnes. */
  readonly characterSheetId: string;
  /** Identifiant du demandeur (issu de la session authentifiée). */
  readonly ownerId: string;
}
