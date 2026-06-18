import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

export interface PendingInvitationView {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string;
  createdAt: Date;
}

export interface GroupInvitationRepository {
  save(invitation: GroupInvitation): Promise<void>;
  findById(id: string): Promise<GroupInvitation | null>;
  findPendingByGroupAndUser(
    groupId: string,
    invitedUserId: string,
  ): Promise<GroupInvitation | null>;
  findPendingViewsByInvitedUser(invitedUserId: string): Promise<PendingInvitationView[]>;
  updateStatus(id: string, status: InvitationStatus): Promise<void>;
}
