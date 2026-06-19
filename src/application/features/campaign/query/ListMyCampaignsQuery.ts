export interface ListMyCampaignsQuery {
  /** Identifiant du groupe dont on veut les campagnes (issu du paramètre de requête HTTP). */
  readonly groupId: string;
  /** Identifiant de l'utilisateur courant (pour vérifier son appartenance au groupe). */
  readonly userId: string;
}
