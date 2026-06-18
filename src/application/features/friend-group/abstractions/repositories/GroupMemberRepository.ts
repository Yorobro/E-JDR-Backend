import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

export interface GroupMemberRepository {
  save(membership: GroupMembership): Promise<void>;
  findByGroupId(groupId: string): Promise<GroupMembership[]>;
  findByUserIdAndGroupId(userId: string, groupId: string): Promise<GroupMembership | null>;
  countAdminsByGroupId(groupId: string): Promise<number>;
  deleteByUserIdAndGroupId(userId: string, groupId: string): Promise<void>;
  updateRole(userId: string, groupId: string, role: GroupRole): Promise<void>;
}
