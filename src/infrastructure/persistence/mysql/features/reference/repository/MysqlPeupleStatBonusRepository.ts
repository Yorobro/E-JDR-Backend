import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";
import { PeupleStatBonusRepository } from "@application/features/reference/abstractions/repositories/PeupleStatBonusRepository";
import { PeupleStatBonusDao } from "@infrastructure/persistence/mysql/features/reference/dao/PeupleStatBonusDao";
import { PeupleStatBonusMapper } from "@infrastructure/persistence/mysql/features/reference/mappers/PeupleStatBonusMapper";

/** Implémentation MySQL/Drizzle des bonus de statistique d'un peuple. */
export class MysqlPeupleStatBonusRepository implements PeupleStatBonusRepository {
  constructor(private readonly dao: PeupleStatBonusDao) {}

  public async link(peupleId: string, statBonus: StatBonus, createdAt: Date): Promise<void> {
    await this.dao.insert(PeupleStatBonusMapper.toRow(peupleId, statBonus, createdAt));
  }

  public async findByPeuple(peupleId: string): Promise<StatBonus[]> {
    const rows = await this.dao.findByPeuple(peupleId);
    return rows.map(PeupleStatBonusMapper.toDomain);
  }

  public async deleteByPeuple(peupleId: string): Promise<void> {
    await this.dao.deleteByPeuple(peupleId);
  }
}
