import { FriendGroup } from "@domain/features/friend-group/entities/FriendGroup";
import { FriendGroupName } from "@domain/features/friend-group/value-objects/FriendGroupName";
import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import {
  GroupMemberRepository,
  GroupMemberView,
} from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import {
  GroupInvitationRepository,
  PendingInvitationView,
} from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";

export class FakeFriendGroupRepository implements FriendGroupRepository {
  private readonly groups = new Map<string, FriendGroup>();

  public async save(group: FriendGroup): Promise<void> {
    this.groups.set(group.id, group);
  }

  public async findById(id: string): Promise<FriendGroup | null> {
    return this.groups.get(id) ?? null;
  }

  public async findByMemberId(_userId: string): Promise<FriendGroup[]> {
    return [...this.groups.values()];
  }

  public async deleteById(id: string): Promise<void> {
    this.groups.delete(id);
  }

  public seed(group: FriendGroup): void {
    this.groups.set(group.id, group);
  }
}

export class FakeGroupMemberRepository implements GroupMemberRepository {
  private readonly memberships = new Map<string, GroupMembership>();

  private key(userId: string, groupId: string): string {
    return `${groupId}::${userId}`;
  }

  public async save(membership: GroupMembership): Promise<void> {
    this.memberships.set(this.key(membership.userId, membership.groupId), membership);
  }

  public async findByGroupId(groupId: string): Promise<GroupMembership[]> {
    return [...this.memberships.values()].filter((m) => m.groupId === groupId);
  }

  public async findViewsByGroupId(groupId: string): Promise<GroupMemberView[]> {
    return [...this.memberships.values()]
      .filter((m) => m.groupId === groupId)
      .map((m) => ({
        userId: m.userId,
        pseudo: `pseudo-${m.userId}`,
        role: m.role.value,
        createdAt: m.createdAt,
      }));
  }

  public async findByUserIdAndGroupId(
    userId: string,
    groupId: string,
  ): Promise<GroupMembership | null> {
    return this.memberships.get(this.key(userId, groupId)) ?? null;
  }

  public async countAdminsByGroupId(groupId: string): Promise<number> {
    return [...this.memberships.values()].filter((m) => m.groupId === groupId && m.isAdmin())
      .length;
  }

  public async deleteByUserIdAndGroupId(userId: string, groupId: string): Promise<void> {
    this.memberships.delete(this.key(userId, groupId));
  }

  public async updateRole(userId: string, groupId: string, role: GroupRole): Promise<void> {
    const key = this.key(userId, groupId);
    const existing = this.memberships.get(key);
    if (existing) {
      this.memberships.set(
        key,
        GroupMembership.restore({
          groupId: existing.groupId,
          userId: existing.userId,
          role,
          createdAt: existing.createdAt,
        }),
      );
    }
  }

  public seed(membership: GroupMembership): void {
    this.memberships.set(this.key(membership.userId, membership.groupId), membership);
  }
}

export class FakeGroupInvitationRepository implements GroupInvitationRepository {
  private readonly invitations = new Map<string, GroupInvitation>();

  public async save(invitation: GroupInvitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }

  public async findById(id: string): Promise<GroupInvitation | null> {
    return this.invitations.get(id) ?? null;
  }

  public async findPendingByGroupAndUser(
    groupId: string,
    invitedUserId: string,
  ): Promise<GroupInvitation | null> {
    for (const inv of this.invitations.values()) {
      if (inv.groupId === groupId && inv.invitedUserId === invitedUserId && inv.isPending()) {
        return inv;
      }
    }
    return null;
  }

  public async findPendingViewsByInvitedUser(
    invitedUserId: string,
  ): Promise<PendingInvitationView[]> {
    return [...this.invitations.values()]
      .filter((inv) => inv.invitedUserId === invitedUserId && inv.isPending())
      .map((inv) => ({
        id: inv.id,
        groupId: inv.groupId,
        groupName: "Groupe factice",
        invitedBy: inv.invitedBy,
        invitedByPseudo: `pseudo-${inv.invitedBy}`,
        createdAt: inv.createdAt,
      }));
  }

  public async updateStatus(id: string, status: InvitationStatus): Promise<void> {
    const existing = this.invitations.get(id);
    if (existing) {
      this.invitations.set(
        id,
        GroupInvitation.restore({
          id: existing.id,
          groupId: existing.groupId,
          invitedUserId: existing.invitedUserId,
          invitedBy: existing.invitedBy,
          status,
          createdAt: existing.createdAt,
        }),
      );
    }
  }

  public async deleteByGroupAndUser(groupId: string, invitedUserId: string): Promise<void> {
    for (const [id, inv] of this.invitations.entries()) {
      if (inv.groupId === groupId && inv.invitedUserId === invitedUserId) {
        this.invitations.delete(id);
      }
    }
  }

  public seed(invitation: GroupInvitation): void {
    this.invitations.set(invitation.id, invitation);
  }
}

export function buildTestFriendGroup(
  overrides?: Partial<{ id: string; name: string; createdBy: string }>,
): FriendGroup {
  return FriendGroup.create({
    id: overrides?.id ?? "group-1",
    name: FriendGroupName.create(overrides?.name ?? "Les Aventuriers"),
    createdBy: overrides?.createdBy ?? "user-1",
    createdAt: new Date("2026-01-01"),
  });
}

export function buildTestMembership(
  overrides?: Partial<{
    groupId: string;
    userId: string;
    role: GroupRole;
  }>,
): GroupMembership {
  return GroupMembership.create({
    groupId: overrides?.groupId ?? "group-1",
    userId: overrides?.userId ?? "user-1",
    role: overrides?.role ?? GroupRole.ADMIN,
    createdAt: new Date("2026-01-01"),
  });
}

export function buildTestInvitation(
  overrides?: Partial<{
    id: string;
    groupId: string;
    invitedUserId: string;
    invitedBy: string;
    status: InvitationStatus;
  }>,
): GroupInvitation {
  return GroupInvitation.create({
    id: overrides?.id ?? "inv-1",
    groupId: overrides?.groupId ?? "group-1",
    invitedUserId: overrides?.invitedUserId ?? "user-2",
    invitedBy: overrides?.invitedBy ?? "user-1",
    status: overrides?.status ?? InvitationStatus.PENDING,
    createdAt: new Date("2026-01-01"),
  });
}
