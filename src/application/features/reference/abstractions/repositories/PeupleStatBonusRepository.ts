import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";

/**
 * Port « out » des **bonus de statistique d'un peuple** (table de jointure `peuple_stat_bonuses`).
 *
 * Un peuple porte 0..N bonus, **au plus un par statistique** — invariant garanti à la fois par le
 * domaine ({@link StatBonus.createMany}) et par la PK composite `(peuple_id, stat)` en base.
 *
 * Une **formation**, elle, reste mono-bonus : elle conserve ses colonnes `stat`/`bonus` et ne passe
 * pas par ce port.
 */
export interface PeupleStatBonusRepository {
  /**
   * Rattache un bonus de statistique à un peuple.
   *
   * @param peupleId - Identifiant du peuple.
   * @param statBonus - Le bonus à poser (stat + montant, déjà validés).
   * @param createdAt - Horodatage du rattachement.
   */
  link(peupleId: string, statBonus: StatBonus, createdAt: Date): Promise<void>;

  /**
   * Liste les bonus de statistique d'un peuple.
   *
   * @param peupleId - Identifiant du peuple.
   * @returns Les bonus rattachés (vide si aucun).
   */
  findByPeuple(peupleId: string): Promise<StatBonus[]>;

  /**
   * Supprime **tous** les bonus d'un peuple (remplacement complet lors d'une modification : on
   * efface puis on réinsère la nouvelle liste, dans la même transaction).
   *
   * @param peupleId - Identifiant du peuple dont les bonus sont à supprimer.
   */
  deleteByPeuple(peupleId: string): Promise<void>;
}
