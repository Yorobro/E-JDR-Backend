/**
 * Commande d'entrée du use case de suppression de fiche.
 *
 * Le `ownerId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur
 * est bien le propriétaire avant toute suppression.
 */
export interface DeleteCharacterSheetCommand {
  /** Identifiant de la fiche à supprimer. */
  readonly characterSheetId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly ownerId: string;
}
