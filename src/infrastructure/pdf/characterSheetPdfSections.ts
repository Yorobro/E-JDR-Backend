import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/** Une ligne de rendu : libellé français + valeur déjà formatée ("—" si vide). */
export interface PdfField {
  readonly label: string;
  readonly value: string;
}

/** Une section du PDF : titre + lignes. */
export interface PdfSection {
  readonly title: string;
  readonly fields: PdfField[];
}

/** Affiche une valeur scalaire, "—" si null/undefined/chaîne vide. */
function show(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
}

/** Formate la bourse en "1 PO · 50 PA · 0 PC", "—" si absente. */
function showPurse(detail: CharacterSheetDetail): string {
  const p = detail.purse;
  if (p === null) {
    return "—";
  }
  return `${p.gold} PO · ${p.silver} PA · ${p.copper} PC`;
}

/**
 * Construit les sections imprimables d'une fiche dans l'ordre métier :
 * Identité / Caractéristiques / Combat / Bourse / Armes / Armures / Compétences /
 * Équipement / Sorts & Miracles / Notes.
 */
export function buildCharacterSheetSections(detail: CharacterSheetDetail): PdfSection[] {
  return [
    {
      title: "Identité",
      fields: [
        { label: "Formation", value: show(detail.formation) },
        { label: "Niveau", value: show(detail.niveau) },
        { label: "Peuple", value: show(detail.peuple) },
        { label: "Sexe", value: show(detail.sexe) },
        { label: "Taille et poids", value: show(detail.tailleEtPoids) },
        { label: "Âge", value: show(detail.age) },
        { label: "Apparence", value: show(detail.apparence) },
      ],
    },
    {
      title: "Caractéristiques",
      fields: [
        { label: "Dextérité", value: show(detail.dexterite) },
        { label: "Intelligence", value: show(detail.intelligence) },
        { label: "Perception", value: show(detail.perception) },
        { label: "Social", value: show(detail.social) },
        { label: "Vigueur", value: show(detail.vigueur) },
      ],
    },
    {
      title: "Combat",
      fields: [
        { label: "Points de vie", value: show(detail.pointsDeVie) },
        { label: "Points de magie", value: show(detail.pointsDeMagie) },
        { label: "Protection", value: show(detail.protection) },
      ],
    },
    { title: "Bourse", fields: [{ label: "Pièces", value: showPurse(detail) }] },
    { title: "Armes", fields: [{ label: "Armes", value: show(detail.armes) }] },
    { title: "Armures", fields: [{ label: "Armures", value: show(detail.armures) }] },
    { title: "Compétences", fields: [{ label: "Compétences", value: show(detail.competences) }] },
    { title: "Équipement", fields: [{ label: "Équipement", value: show(detail.equipement) }] },
    {
      title: "Sorts & Miracles",
      fields: [{ label: "Sorts & Miracles", value: show(detail.sortsEtMiracles) }],
    },
    { title: "Notes", fields: [{ label: "Notes", value: show(detail.notes) }] },
  ];
}
