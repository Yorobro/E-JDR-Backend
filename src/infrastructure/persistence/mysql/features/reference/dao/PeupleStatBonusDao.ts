import { asc, eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { peupleStatBonuses } from "@infrastructure/persistence/drizzle/schema";

/** Ligne brute de la table `peuple_stat_bonuses`. */
export type PeupleStatBonusRow = typeof peupleStatBonuses.$inferSelect;

/**
 * DAO de la table **`peuple_stat_bonuses`** (bonus de statistique d'un peuple, 0..N, au plus un par
 * stat grâce à la PK composite `(peuple_id, stat)`).
 */
export class PeupleStatBonusDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: PeupleStatBonusRow): Promise<void> {
    await this.executor.insert(peupleStatBonuses).values(row);
  }

  /** @returns Les bonus du peuple, dans l'ordre de rattachement (stable d'un appel à l'autre). */
  public async findByPeuple(peupleId: string): Promise<PeupleStatBonusRow[]> {
    return this.executor
      .select()
      .from(peupleStatBonuses)
      .where(eq(peupleStatBonuses.peuple_id, peupleId))
      .orderBy(asc(peupleStatBonuses.created_at), asc(peupleStatBonuses.stat));
  }

  public async deleteByPeuple(peupleId: string): Promise<void> {
    await this.executor.delete(peupleStatBonuses).where(eq(peupleStatBonuses.peuple_id, peupleId));
  }
}
