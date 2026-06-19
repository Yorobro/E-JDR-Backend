import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

/** Vue d'un membre enrichie du pseudo, pour l'affichage (pas une entité domaine). */
export interface GroupMemberView {
  userId: string;
  pseudo: string;
  role: string;
  createdAt: Date;
}

export interface GroupMemberRepository {
  save(membership: GroupMembership): Promise<void>;
  findByGroupId(groupId: string): Promise<GroupMembership[]>;
  findViewsByGroupId(groupId: string): Promise<GroupMemberView[]>;
  findByUserIdAndGroupId(userId: string, groupId: string): Promise<GroupMembership | null>;
  countAdminsByGroupId(groupId: string): Promise<number>;
  deleteByUserIdAndGroupId(userId: string, groupId: string): Promise<void>;
  updateRole(userId: string, groupId: string, role: GroupRole): Promise<void>;
}
