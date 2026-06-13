import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { CharacterSheetRow } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";

/**
 * Traduit entre la représentation **persistance** (`CharacterSheetRow`) et l'**entité domaine**
 * (`CharacterSheet`). Frontière où le value object `CharacterSheetName` traverse la limite du
 * cœur. Mapper sans état.
 */
export class CharacterSheetMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `CharacterSheet`.
   *
   * @param row - La ligne `character_sheets` issue de la base.
   * @returns L'entité reconstruite.
   */
  public static toDomain(row: CharacterSheetRow): CharacterSheet {
    return CharacterSheet.restore({
      id: row.id,
      ownerId: row.owner_id,
      name: CharacterSheetName.create(row.name),
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param sheet - L'entité à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de `character_sheets`.
   */
  public static toRow(sheet: CharacterSheet): {
    id: string;
    owner_id: string;
    name: string;
    created_at: Date;
  } {
    return {
      id: sheet.id,
      owner_id: sheet.ownerId,
      name: sheet.name.value,
      created_at: sheet.createdAt,
    };
  }
}
