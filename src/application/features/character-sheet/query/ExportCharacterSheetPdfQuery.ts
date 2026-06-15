/**
 * Requête d'export PDF d'une fiche de personnage.
 *
 * Le `ownerId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur est
 * bien le propriétaire de la fiche (sinon 403), jamais à filtrer une liste.
 */
export interface ExportCharacterSheetPdfQuery {
  /** Identifiant de la fiche à exporter. */
  readonly characterSheetId: string;
  /** Identifiant du demandeur (issu de la session authentifiée). */
  readonly ownerId: string;
}
