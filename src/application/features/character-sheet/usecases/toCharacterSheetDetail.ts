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
    formation: d.formation,
    niveau: d.niveau,
    peuple: d.peuple,
    sexe: d.sexe?.value ?? null,
    tailleEtPoids: d.tailleEtPoids,
    age: d.age,
    apparence: d.apparence,
    dexterite: d.dexterite,
    intelligence: d.intelligence,
    perception: d.perception,
    social: d.social,
    vigueur: d.vigueur,
    pointsDeVie: d.pointsDeVie,
    pointsDeMagie: d.pointsDeMagie,
    protection: d.protection,
    competences: d.competences,
    purse:
      d.purse != null
        ? { gold: d.purse.gold, silver: d.purse.silver, copper: d.purse.copper }
        : null,
    armures: d.armures,
    armes: d.armes,
    equipement: d.equipement,
    sortsEtMiracles: d.sortsEtMiracles,
    notes: d.notes,
  };
}
