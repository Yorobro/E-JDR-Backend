import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";
import {
  GroupInvitationRepository,
  PendingInvitationView,
} from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { GroupInvitationDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupInvitationDao";
import { GroupInvitationMapper } from "@infrastructure/persistence/mysql/features/friend-group/mappers/GroupInvitationMapper";

export class MysqlGroupInvitationRepository implements GroupInvitationRepository {
  constructor(private readonly dao: GroupInvitationDao) {}

  public async save(invitation: GroupInvitation): Promise<void> {
    await this.dao.insert(GroupInvitationMapper.toRow(invitation));
  }

  public async findById(id: string): Promise<GroupInvitation | null> {
    const row = await this.dao.findById(id);
    return row === null ? null : GroupInvitationMapper.toDomain(row);
  }

  public async findPendingByGroupAndUser(
    groupId: string,
    invitedUserId: string,
  ): Promise<GroupInvitation | null> {
    const row = await this.dao.findPendingByGroupAndUser(groupId, invitedUserId);
    return row === null ? null : GroupInvitationMapper.toDomain(row);
  }

  public async findPendingViewsByInvitedUser(
    invitedUserId: string,
  ): Promise<PendingInvitationView[]> {
    const rows = await this.dao.findPendingViewsByInvitedUser(invitedUserId);
    return rows.map((row) => GroupInvitationMapper.toPendingView(row));
  }

  public async updateStatus(id: string, status: InvitationStatus): Promise<void> {
    await this.dao.updateStatus(id, status.value);
  }

  public async deleteByGroupAndUser(groupId: string, invitedUserId: string): Promise<void> {
    await this.dao.deleteByGroupAndUser(groupId, invitedUserId);
  }
}
