import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { ReferenceRow } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";

/**
 * Traduit entre la représentation **persistance** (`ReferenceRow`) et l'**entité domaine**
 * (`ReferenceItem`). Le value object `ReferenceName` est ré-encapsulé en lecture et déballé en
 * écriture. Mapper sans état, partagé par les six catégories (mêmes colonnes).
 */
export class ReferenceMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine.
   *
   * @param row - La ligne issue d'une table de référence.
   * @returns L'entité `ReferenceItem` reconstruite.
   */
  public static toDomain(row: ReferenceRow): ReferenceItem {
    return ReferenceItem.restore({
      id: row.id,
      ownerId: row.owner_id,
      name: ReferenceName.create(row.name),
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param item - L'entité à persister.
   * @returns Un objet dont les clés correspondent aux colonnes d'une table de référence.
   */
  public static toRow(item: ReferenceItem): {
    id: string;
    owner_id: string;
    name: string;
    created_at: Date;
  } {
    return {
      id: item.id,
      owner_id: item.ownerId,
      name: item.name.value,
      created_at: item.createdAt,
    };
  }
}
