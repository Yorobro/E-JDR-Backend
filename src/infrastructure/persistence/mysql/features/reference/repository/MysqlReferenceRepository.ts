import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { ReferenceDao } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";
import { ReferenceMapper } from "@infrastructure/persistence/mysql/features/reference/mappers/ReferenceMapper";

export class MysqlReferenceRepository implements ReferenceRepository {
  constructor(private readonly dao: ReferenceDao) {}

  public async save(item: ReferenceItem): Promise<void> {
    await this.dao.insert(ReferenceMapper.toRow(item));
  }

  public async findByGroupId(groupId: string): Promise<ReferenceItem[]> {
    const rows = await this.dao.findByGroupId(groupId);
    return rows.map((row) => ReferenceMapper.toDomain(row));
  }

  public async findById(id: string): Promise<ReferenceItem | null> {
    const row = await this.dao.findById(id);
    return row === null ? null : ReferenceMapper.toDomain(row);
  }

  public async existsByGroupAndName(groupId: string, name: string): Promise<boolean> {
    return this.dao.existsByGroupAndName(groupId, name);
  }

  public async deleteById(id: string): Promise<void> {
    await this.dao.deleteById(id);
  }
}
