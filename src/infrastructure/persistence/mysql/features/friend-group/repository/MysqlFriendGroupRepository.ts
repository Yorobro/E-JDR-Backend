import { FriendGroup } from "@domain/features/friend-group/entities/FriendGroup";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { FriendGroupDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/FriendGroupDao";
import { FriendGroupMapper } from "@infrastructure/persistence/mysql/features/friend-group/mappers/FriendGroupMapper";

export class MysqlFriendGroupRepository implements FriendGroupRepository {
  constructor(private readonly dao: FriendGroupDao) {}

  public async save(group: FriendGroup): Promise<void> {
    await this.dao.insert(FriendGroupMapper.toRow(group));
  }

  public async findById(id: string): Promise<FriendGroup | null> {
    const row = await this.dao.findById(id);
    return row === null ? null : FriendGroupMapper.toDomain(row);
  }

  public async findByMemberId(userId: string): Promise<FriendGroup[]> {
    const rows = await this.dao.findByMemberId(userId);
    return rows.map((row) => FriendGroupMapper.toDomain(row));
  }

  public async deleteById(id: string): Promise<void> {
    await this.dao.deleteById(id);
  }
}
