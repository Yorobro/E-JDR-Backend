/**
 * Commande de mise à jour d'une fiche de personnage.
 *
 * Le `ownerId` provient de l'utilisateur authentifié (jamais du corps de la requête) et sert à
 * vérifier la propriété de la fiche. Le `name` est revalidé par le value object
 * `CharacterSheetName` au sein du use case. Les champs détaillés sont optionnels et nullables
 * (saisie souple, aucune règle métier).
 */
export interface UpdateCharacterSheetCommand {
  /** Identifiant de la fiche à modifier. */
  readonly characterSheetId: string;
  /** Identifiant du demandeur (issu de la session authentifiée). */
  readonly ownerId: string;
  /** Nom de la fiche saisi par l'utilisateur (brut, revalidé via `CharacterSheetName`). */
  readonly name: string;
  // Identité (texte court, niveau/âge entiers)
  readonly formation?: string | null;
  readonly niveau?: number | null;
  readonly peuple?: string | null;
  readonly sexe?: string | null;
  readonly tailleEtPoids?: string | null;
  readonly age?: number | null;
  readonly apparence?: string | null;
  // Caractéristiques (entiers)
  readonly dexterite?: number | null;
  readonly intelligence?: number | null;
  readonly perception?: number | null;
  readonly social?: number | null;
  readonly vigueur?: number | null;
  // Ressources de combat (entiers)
  readonly pointsDeVie?: number | null;
  readonly pointsDeMagie?: number | null;
  readonly protection?: number | null;
  // Bourse (pièces brutes, validées via le value object `Purse`)
  readonly purse?: { gold?: number | null; silver?: number | null; copper?: number | null } | null;
  // Zones de texte long
  readonly competences?: string | null;
  readonly armes?: string | null;
  readonly armures?: string | null;
  readonly equipement?: string | null;
  readonly sortsEtMiracles?: string | null;
  readonly notes?: string | null;
}
