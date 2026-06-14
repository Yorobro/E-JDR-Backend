import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/**
 * Projette une entité `CharacterSheet` vers son DTO de lecture complet `CharacterSheetDetail`.
 *
 * Partagé par les use cases get-by-id et update, qui renvoient tous deux la fiche complète.
 *
 * @param sheet - L'entité à projeter.
 * @returns La représentation publique détaillée (id/ownerId/name/createdAt + champs détaillés).
 */
export function toCharacterSheetDetail(sheet: CharacterSheet): CharacterSheetDetail {
  return {
    id: sheet.id,
    ownerId: sheet.ownerId,
    name: sheet.name.value,
    createdAt: sheet.createdAt,
    ...sheet.details,
  };
}
