import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";
import { PendingInvitationView } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import {
  GroupInvitationRow,
  PendingInvitationJoinRow,
} from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupInvitationDao";

export class GroupInvitationMapper {
  public static toDomain(row: GroupInvitationRow): GroupInvitation {
    return GroupInvitation.restore({
      id: row.id,
      groupId: row.group_id,
      invitedUserId: row.invited_user_id,
      invitedBy: row.invited_by,
      status: InvitationStatus.create(row.status),
      createdAt: row.created_at,
    });
  }

  public static toRow(invitation: GroupInvitation): {
    id: string;
    group_id: string;
    invited_user_id: string;
    invited_by: string;
    status: string;
    created_at: Date;
  } {
    return {
      id: invitation.id,
      group_id: invitation.groupId,
      invited_user_id: invitation.invitedUserId,
      invited_by: invitation.invitedBy,
      status: invitation.status.value,
      created_at: invitation.createdAt,
    };
  }

  public static toPendingView(row: PendingInvitationJoinRow): PendingInvitationView {
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      invitedBy: row.invited_by,
      createdAt: row.created_at,
    };
  }
}
