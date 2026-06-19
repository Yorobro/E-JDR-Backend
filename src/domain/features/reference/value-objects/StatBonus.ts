import { InvalidStatBonusError } from "@domain/features/reference/errors/InvalidStatBonusError";

/**
 * Liste **exhaustive** des statistiques sur lesquelles un bonus peut porter (formation ou peuple).
 *
 * Alignée sur les caractéristiques de fiche du jeu. Toute valeur hors de cette liste est rejetée
 * à la construction de {@link StatBonus}.
 */
export const ALLOWED_STATS = [
  "dexterite",
  "intelligence",
  "perception",
  "social",
  "vigueur",
] as const;

/** Type union des statistiques autorisées (dérivé de {@link ALLOWED_STATS}). */
export type Stat = (typeof ALLOWED_STATS)[number];

/** Montant par défaut appliqué à un bonus lorsque l'appelant n'en fournit pas. */
const DEFAULT_AMOUNT = 1;

/**
 * Value Object représentant un **bonus de statistique** : une statistique ciblée et le montant
 * (entier ≥ 1) ajouté à cette statistique. Porté optionnellement par une formation ou un peuple.
 *
 * L'invariant « stat autorisée + montant entier ≥ 1 » est garanti par la construction : impossible
 * d'obtenir une instance incohérente. Le VO est immuable.
 *
 * L'**absence** de bonus (stat non renseignée) n'est pas modélisée par ce VO : elle est exprimée
 * par `null` côté entité/appelant. Ce VO ne représente donc qu'un bonus **présent et valide**.
 */
export class StatBonus {
  /**
   * @param _stat - La statistique ciblée (déjà validée).
   * @param _amount - Le montant du bonus (entier ≥ 1, déjà validé).
   *                  Le constructeur est privé : on passe par {@link StatBonus.create}.
   */
  private constructor(
    private readonly _stat: Stat,
    private readonly _amount: number,
  ) {}

  /**
   * Crée un `StatBonus` après validation.
   *
   * @param params - Les données brutes du bonus.
   * @param params.stat - La statistique ciblée (doit appartenir à {@link ALLOWED_STATS}).
   * @param params.amount - Le montant du bonus (entier ≥ 1 ; vaut 1 par défaut si non fourni).
   * @returns Une instance de `StatBonus` garantie valide.
   * @throws {InvalidStatBonusError} Si la stat est absente/hors liste, ou si le montant n'est pas
   *                                 un entier supérieur ou égal à 1.
   */
  public static create(params: { stat: string; amount?: number | null }): StatBonus {
    const { stat } = params;

    if (typeof stat !== "string" || !ALLOWED_STATS.includes(stat as Stat)) {
      throw new InvalidStatBonusError(
        `la statistique doit faire partie de [${ALLOWED_STATS.join(", ")}]`,
      );
    }

    const amount = params.amount ?? DEFAULT_AMOUNT;

    if (!Number.isInteger(amount)) {
      throw new InvalidStatBonusError("le montant doit être un entier");
    }

    if (amount < 1) {
      throw new InvalidStatBonusError("le montant doit être supérieur ou égal à 1");
    }

    return new StatBonus(stat as Stat, amount);
  }

  /** @returns La statistique ciblée par le bonus. */
  public get stat(): Stat {
    return this._stat;
  }

  /** @returns Le montant du bonus (entier ≥ 1). */
  public get amount(): number {
    return this._amount;
  }
}
