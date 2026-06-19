import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";
import { ReferenceRow } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";

export class ReferenceMapper {
  public static toDomain(row: ReferenceRow): ReferenceItem {
    // stat/bonus ne sont peuplés que pour formations/peoples ; pour les autres tables ils sont
    // absents ⇒ aucun bonus.
    const statBonus =
      row.stat != null
        ? StatBonus.create({ stat: row.stat, amount: row.bonus ?? undefined })
        : null;
    return ReferenceItem.restore({
      id: row.id,
      groupId: row.group_id,
      name: ReferenceName.create(row.name),
      createdAt: new Date(row.created_at),
      statBonus,
    });
  }

  public static toRow(item: ReferenceItem): {
    id: string;
    group_id: string;
    name: string;
    created_at: Date;
    stat: string | null;
    bonus: number | null;
  } {
    const statBonus = item.statBonus;
    return {
      id: item.id,
      group_id: item.groupId,
      name: item.name.value,
      created_at: item.createdAt,
      stat: statBonus?.stat ?? null,
      bonus: statBonus?.amount ?? null,
    };
  }
}
