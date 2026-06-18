import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupMemberDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupMemberDao";
import { GroupMemberMapper } from "@infrastructure/persistence/mysql/features/friend-group/mappers/GroupMemberMapper";

export class MysqlGroupMemberRepository implements GroupMemberRepository {
  constructor(private readonly dao: GroupMemberDao) {}

  public async save(membership: GroupMembership): Promise<void> {
    await this.dao.insert(GroupMemberMapper.toRow(membership));
  }

  public async findByGroupId(groupId: string): Promise<GroupMembership[]> {
    const rows = await this.dao.findByGroupId(groupId);
    return rows.map((row) => GroupMemberMapper.toDomain(row));
  }

  public async findByUserIdAndGroupId(
    userId: string,
    groupId: string,
  ): Promise<GroupMembership | null> {
    const row = await this.dao.findByUserIdAndGroupId(userId, groupId);
    return row === null ? null : GroupMemberMapper.toDomain(row);
  }

  public async countAdminsByGroupId(groupId: string): Promise<number> {
    return this.dao.countAdminsByGroupId(groupId);
  }

  public async deleteByUserIdAndGroupId(userId: string, groupId: string): Promise<void> {
    await this.dao.deleteByUserIdAndGroupId(userId, groupId);
  }

  public async updateRole(userId: string, groupId: string, role: GroupRole): Promise<void> {
    await this.dao.updateRole(userId, groupId, role.value);
  }
}
