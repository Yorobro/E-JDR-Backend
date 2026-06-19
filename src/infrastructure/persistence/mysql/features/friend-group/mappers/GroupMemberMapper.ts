import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { GroupMemberRow } from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupMemberDao";

export class GroupMemberMapper {
  public static toDomain(row: GroupMemberRow): GroupMembership {
    return GroupMembership.restore({
      groupId: row.group_id,
      userId: row.user_id,
      role: GroupRole.create(row.role),
      createdAt: row.created_at,
    });
  }

  public static toRow(membership: GroupMembership): {
    group_id: string;
    user_id: string;
    role: string;
    created_at: Date;
  } {
    return {
      group_id: membership.groupId,
      user_id: membership.userId,
      role: membership.role.value,
      created_at: membership.createdAt,
    };
  }
}
