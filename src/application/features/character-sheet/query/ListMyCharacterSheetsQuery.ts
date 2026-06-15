/**
 * Requête de lecture du use case « lister mes fiches ».
 *
 * Le `ownerId` provient de l'utilisateur authentifié : on ne liste que ses propres fiches.
 */
export interface ListMyCharacterSheetsQuery {
  /** Identifiant du propriétaire dont on veut les fiches (issu de la session). */
  readonly ownerId: string;
}
