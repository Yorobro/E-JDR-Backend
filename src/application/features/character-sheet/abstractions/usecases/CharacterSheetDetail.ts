/**
 * Représentation publique **complète** (lecture) d'une fiche de personnage.
 *
 * Renvoyée par les use cases de consultation détaillée (get-by-id) et de mise à jour. Contient
 * l'identité technique, le nom et tous les champs détaillés (identité, caractéristiques, textes
 * longs). Les champs détaillés sont nullables (saisie souple). Distincte du `CharacterSheetSummary`
 * (nom seul) utilisé dans les listes.
 */
export interface CharacterSheetDetail {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt: Date;
  // Identité (texte court)
  readonly formation: string | null;
  readonly niveau: string | null;
  readonly peuple: string | null;
  readonly sexe: string | null;
  readonly tailleEtPoids: string | null;
  readonly age: string | null;
  readonly apparence: string | null;
  // Caractéristiques (entiers)
  readonly dexterite: number | null;
  readonly intelligence: number | null;
  readonly perception: number | null;
  readonly social: number | null;
  readonly vigueur: number | null;
  // Ressources de combat (entiers)
  readonly pointsDeVie: number | null;
  readonly pointsDeMagie: number | null;
  readonly protection: number | null;
  readonly monnaie: number | null;
  // Zones de texte long
  readonly armes: string | null;
  readonly armures: string | null;
  readonly equipement: string | null;
  readonly sortsEtMiracles: string | null;
  readonly notes: string | null;
}
