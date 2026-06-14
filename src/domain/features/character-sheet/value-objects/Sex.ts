import { InvalidSexError } from "@domain/features/character-sheet/errors/InvalidSexError";

/** Valeurs autorisées pour le sexe d'un personnage. */
export type SexValue = "M" | "F" | "NB";

const ALLOWED: readonly SexValue[] = ["M", "F", "NB"];

/**
 * Value object représentant le **sexe** d'un personnage, contraint à M, F ou NB. Immuable.
 * Normalise la casse et les espaces de bord.
 */
export class Sex {
  private constructor(public readonly value: SexValue) {}

  /**
   * @param raw - Valeur brute saisie.
   * @throws {InvalidSexError} Si la valeur normalisée n'est pas M/F/NB.
   */
  public static create(raw: string): Sex {
    const normalized = (raw ?? "").trim().toUpperCase();
    if (!ALLOWED.includes(normalized as SexValue)) {
      throw new InvalidSexError(`valeur « ${raw} » non autorisée (attendu M, F ou NB)`);
    }
    return new Sex(normalized as SexValue);
  }
}
