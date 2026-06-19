/**
 * Requête de lecture du use case « lister les fiches du groupe actif ».
 *
 * Visibilité « tout le groupe » (D10) : on liste **toutes** les fiches du groupe, à condition que
 * le demandeur en soit membre. Le `userId` provient de l'utilisateur authentifié ; le `groupId`
 * est le groupe actif.
 */
export interface ListMyCharacterSheetsQuery {
  /** Identifiant du demandeur (issu de la session authentifiée ; doit être membre du groupe). */
  readonly userId: string;
  /** Identifiant du groupe actif dont on veut lister les fiches. */
  readonly groupId: string;
}
