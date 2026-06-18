import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { ReferenceRow } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";

export class ReferenceMapper {
  public static toDomain(row: ReferenceRow): ReferenceItem {
    return ReferenceItem.restore({
      id: row.id,
      groupId: row.group_id,
      name: ReferenceName.create(row.name),
      createdAt: new Date(row.created_at),
    });
  }

  public static toRow(item: ReferenceItem): {
    id: string;
    group_id: string;
    name: string;
    created_at: Date;
  } {
    return {
      id: item.id,
      group_id: item.groupId,
      name: item.name.value,
      created_at: item.createdAt,
    };
  }
}
