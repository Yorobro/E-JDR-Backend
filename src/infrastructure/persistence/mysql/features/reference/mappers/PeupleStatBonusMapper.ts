import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";
import { PeupleStatBonusRow } from "@infrastructure/persistence/mysql/features/reference/dao/PeupleStatBonusDao";

/** Traduit une ligne `peuple_stat_bonuses` en value object {@link StatBonus}, et réciproquement. */
export class PeupleStatBonusMapper {
  /**
   * @param row - La ligne brute lue en base.
   * @returns Le value object correspondant.
   * @throws {InvalidStatBonusError} Si la ligne porte une stat hors liste ou un montant invalide
   *                                 (donnée corrompue : on préfère échouer que propager l'incohérence).
   */
  public static toDomain(row: PeupleStatBonusRow): StatBonus {
    return StatBonus.create({ stat: row.stat, amount: row.bonus });
  }

  public static toRow(peupleId: string, statBonus: StatBonus, createdAt: Date): PeupleStatBonusRow {
    return {
      peuple_id: peupleId,
      stat: statBonus.stat,
      bonus: statBonus.amount,
      created_at: createdAt,
    };
  }
}
