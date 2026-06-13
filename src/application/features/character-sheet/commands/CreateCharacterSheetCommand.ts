/**
 * Commande d'entrée du use case de création de fiche.
 *
 * Le `ownerId` provient de l'utilisateur authentifié (jamais du corps de la requête) ;
 * le `name` est validé par le value object `CharacterSheetName` au sein du use case.
 */
export interface CreateCharacterSheetCommand {
  /** Identifiant du propriétaire (issu de la session authentifiée). */
  readonly ownerId: string;
  /** Nom de la fiche saisi par l'utilisateur (brut, non encore validé). */
  readonly name: string;
}
