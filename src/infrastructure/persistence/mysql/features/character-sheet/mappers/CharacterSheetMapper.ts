import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import {
  CharacterSheetRow,
  CharacterSheetWriteRow,
} from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";

/**
 * Traduit entre la représentation **persistance** (`CharacterSheetRow`) et l'**entité domaine**
 * (`CharacterSheet`). Frontière où le value object `CharacterSheetName` traverse la limite du
 * cœur. Mapper sans état.
 */
export class CharacterSheetMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `CharacterSheet`.
   *
   * Tolère les lignes de **projection nom seul** (listes) : les colonnes détaillées absentes
   * (`undefined`) sont normalisées en `null`, produisant une entité valide.
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
      formation: row.formation ?? null,
      niveau: row.niveau ?? null,
      peuple: row.peuple ?? null,
      sexe: row.sexe ?? null,
      tailleEtPoids: row.taille_et_poids ?? null,
      age: row.age ?? null,
      apparence: row.apparence ?? null,
      dexterite: row.dexterite ?? null,
      intelligence: row.intelligence ?? null,
      perception: row.perception ?? null,
      social: row.social ?? null,
      vigueur: row.vigueur ?? null,
      pointsDeVie: row.points_de_vie ?? null,
      pointsDeMagie: row.points_de_magie ?? null,
      protection: row.protection ?? null,
      monnaie: row.monnaie ?? null,
      armes: row.armes ?? null,
      armures: row.armures ?? null,
      equipement: row.equipement ?? null,
      sortsEtMiracles: row.sorts_et_miracles ?? null,
      notes: row.notes ?? null,
    });
  }

  /**
   * Convertit une entité domaine en valeurs de colonnes prêtes pour l'écriture (insert/update).
   *
   * @param sheet - L'entité à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de `character_sheets`.
   */
  public static toRow(sheet: CharacterSheet): CharacterSheetWriteRow {
    const d = sheet.details;
    return {
      id: sheet.id,
      owner_id: sheet.ownerId,
      name: sheet.name.value,
      created_at: sheet.createdAt,
      formation: d.formation,
      niveau: d.niveau,
      peuple: d.peuple,
      sexe: d.sexe,
      taille_et_poids: d.tailleEtPoids,
      age: d.age,
      apparence: d.apparence,
      dexterite: d.dexterite,
      intelligence: d.intelligence,
      perception: d.perception,
      social: d.social,
      vigueur: d.vigueur,
      points_de_vie: d.pointsDeVie,
      points_de_magie: d.pointsDeMagie,
      protection: d.protection,
      monnaie: d.monnaie,
      armes: d.armes,
      armures: d.armures,
      equipement: d.equipement,
      sorts_et_miracles: d.sortsEtMiracles,
      notes: d.notes,
    };
  }
}
