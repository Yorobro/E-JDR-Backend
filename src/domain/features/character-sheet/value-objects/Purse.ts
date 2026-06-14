import { InvalidPurseError } from "@domain/features/character-sheet/errors/InvalidPurseError";

/** Pièces non négatives composant une bourse. */
export interface PurseCoins {
  readonly gold?: number;
  readonly silver?: number;
  readonly copper?: number;
}

/**
 * Value object représentant la **bourse** d'un personnage : pièces d'or (gold), d'argent
 * (silver) et de cuivre (copper). Immuable. Règles : 1 gold = 100 silver, 1 silver = 100 copper
 * (donc 1 gold = 10 000 copper). Chaque montant est un entier ≥ 0.
 */
export class Purse {
  /** Pièces d'argent par pièce d'or. */
  public static readonly SILVER_PER_GOLD = 100;
  /** Pièces de cuivre par pièce d'argent. */
  public static readonly COPPER_PER_SILVER = 100;

  private constructor(
    public readonly gold: number,
    public readonly silver: number,
    public readonly copper: number,
  ) {}

  /**
   * Crée une bourse après validation. Les montants absents valent 0.
   *
   * @param coins - Montants bruts (or/argent/cuivre).
   * @throws {InvalidPurseError} Si un montant est négatif ou non entier.
   */
  public static create(coins: PurseCoins): Purse {
    const gold = Purse.validate(coins.gold ?? 0, "or");
    const silver = Purse.validate(coins.silver ?? 0, "argent");
    const copper = Purse.validate(coins.copper ?? 0, "cuivre");
    return new Purse(gold, silver, copper);
  }

  private static validate(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidPurseError(`le montant de ${label} doit être un entier positif ou nul`);
    }
    return value;
  }

  /** @returns La valeur totale de la bourse, exprimée en pièces de cuivre. */
  public totalInCopper(): number {
    return (
      this.gold * Purse.SILVER_PER_GOLD * Purse.COPPER_PER_SILVER +
      this.silver * Purse.COPPER_PER_SILVER +
      this.copper
    );
  }

  /** @returns Une bourse équivalente sous forme canonique (cuivre/argent recombinés). */
  public normalized(): Purse {
    let total = this.totalInCopper();
    const gold = Math.floor(total / (Purse.SILVER_PER_GOLD * Purse.COPPER_PER_SILVER));
    total -= gold * Purse.SILVER_PER_GOLD * Purse.COPPER_PER_SILVER;
    const silver = Math.floor(total / Purse.COPPER_PER_SILVER);
    const copper = total - silver * Purse.COPPER_PER_SILVER;
    return new Purse(gold, silver, copper);
  }

  /**
   * @param other - Une autre bourse.
   * @returns `true` si les deux ont la même valeur totale.
   */
  public equals(other: Purse): boolean {
    return this.totalInCopper() === other.totalInCopper();
  }
}
