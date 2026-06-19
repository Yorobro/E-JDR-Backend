import { FriendGroup } from "@domain/features/friend-group/entities/FriendGroup";
import { FriendGroupName } from "@domain/features/friend-group/value-objects/FriendGroupName";
import { FriendGroupRow } from "@infrastructure/persistence/mysql/features/friend-group/dao/FriendGroupDao";

export class FriendGroupMapper {
  public static toDomain(row: FriendGroupRow): FriendGroup {
    return FriendGroup.restore({
      id: row.id,
      name: FriendGroupName.create(row.name),
      createdBy: row.created_by,
      createdAt: row.created_at,
    });
  }

  public static toRow(group: FriendGroup): {
    id: string;
    name: string;
    created_by: string;
    created_at: Date;
  } {
    return {
      id: group.id,
      name: group.name.value,
      created_by: group.createdBy,
      created_at: group.createdAt,
    };
  }
}
