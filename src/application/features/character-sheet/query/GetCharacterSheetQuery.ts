/**
 * Requête de consultation détaillée d'une fiche de personnage.
 *
 * Le `userId` provient de l'utilisateur authentifié : il sert à vérifier que le demandeur est
 * **membre du groupe** de la fiche (visibilité « tout le groupe », D10), pas seulement son
 * propriétaire.
 */
export interface GetCharacterSheetQuery {
  /** Identifiant de la fiche à consulter. */
  readonly characterSheetId: string;
  /** Identifiant du demandeur (issu de la session authentifiée). */
  readonly userId: string;
}
