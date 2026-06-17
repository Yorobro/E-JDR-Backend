import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { ReferenceDao } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";
import { ReferenceMapper } from "@infrastructure/persistence/mysql/features/reference/mappers/ReferenceMapper";

/**
 * Implémentation MySQL **générique** du port `ReferenceRepository` : assemble un `ReferenceDao`
 * (lié à une table donnée) et le `ReferenceMapper`. Une instance par catégorie de référence.
 */
export class MysqlReferenceRepository implements ReferenceRepository {
  constructor(private readonly dao: ReferenceDao) {}

  public async save(item: ReferenceItem): Promise<void> {
    await this.dao.insert(ReferenceMapper.toRow(item));
  }

  public async findByOwnerId(ownerId: string): Promise<ReferenceItem[]> {
    const rows = await this.dao.findByOwnerId(ownerId);
    return rows.map((row) => ReferenceMapper.toDomain(row));
  }

  public async findById(id: string): Promise<ReferenceItem | null> {
    const row = await this.dao.findById(id);
    return row === null ? null : ReferenceMapper.toDomain(row);
  }

  public async existsByOwnerAndName(ownerId: string, name: string): Promise<boolean> {
    return this.dao.existsByOwnerAndName(ownerId, name);
  }

  public async deleteById(id: string): Promise<void> {
    await this.dao.deleteById(id);
  }
}
