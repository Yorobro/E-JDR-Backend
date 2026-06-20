import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/** Projette une entité vers son DTO de lecture complet (VO → formes publiques). */
export function toCharacterSheetDetail(sheet: CharacterSheet): CharacterSheetDetail {
  const d = sheet.details;
  return {
    id: sheet.id,
    ownerId: sheet.ownerId,
    name: sheet.name.value,
    createdAt: sheet.createdAt,
    formationId: d.formationId,
    niveau: d.niveau,
    peupleId: d.peupleId,
    sexe: d.sexe?.value ?? null,
    tailleEtPoids: d.tailleEtPoids,
    age: d.age,
    apparence: d.apparence,
    dexterite: d.dexterite,
    intelligence: d.intelligence,
    perception: d.perception,
    social: d.social,
    vigueur: d.vigueur,
    // Totaux par défaut = base (sans bonus) ; le use case de lecture les recalcule avec les bonus
    // formation/peuple résolus avant de renvoyer le détail (dérivés, jamais stockés).
    dexteriteTotale: d.dexterite ?? 0,
    intelligenceTotale: d.intelligence ?? 0,
    perceptionTotale: d.perception ?? 0,
    socialTotale: d.social ?? 0,
    vigueurTotale: d.vigueur ?? 0,
    pointsDeVie: d.pointsDeVie,
    pointsDeMagie: d.pointsDeMagie,
    protection: d.protection,
    purse:
      d.purse != null
        ? { gold: d.purse.gold, silver: d.purse.silver, copper: d.purse.copper }
        : null,
    notes: d.notes,
    // Blocs résolus renseignés par le use case de lecture (repos référence) ; `null` par défaut.
    formation: null,
    peuple: null,
  };
}
