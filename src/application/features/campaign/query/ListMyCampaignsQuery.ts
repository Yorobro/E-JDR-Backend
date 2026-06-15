/**
 * Requête de lecture du use case « lister mes campagnes ».
 *
 * Le `gameMasterId` provient de l'utilisateur authentifié : on ne liste que les campagnes
 * dont il est le maître du jeu.
 */
export interface ListMyCampaignsQuery {
  /** Identifiant du maître du jeu dont on veut les campagnes (issu de la session). */
  readonly gameMasterId: string;
}
