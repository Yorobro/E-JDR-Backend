import { InvalidPseudoError } from "@domain/features/auth/errors/InvalidPseudoError";

/**
 * Value Object représentant un **pseudo (nom d'affichage) valide et normalisé**.
 *
 * Invariant garanti à la construction : non vide après trim, ≤ 50 caractères (aligné sur la
 * colonne `users.pseudo VARCHAR(50)`). Immuable.
 */
export class Pseudo {
  private static readonly MAX_LENGTH = 50;

  private constructor(public readonly value: string) {}

  public static create(raw: string): Pseudo {
    if (typeof raw !== "string") {
      throw new InvalidPseudoError("valeur absente ou de type incorrect");
    }
    const normalized = raw.trim();
    if (normalized.length === 0) {
      throw new InvalidPseudoError("le pseudo ne peut pas être vide");
    }
    if (normalized.length > Pseudo.MAX_LENGTH) {
      throw new InvalidPseudoError(
        `le pseudo ne peut pas dépasser ${Pseudo.MAX_LENGTH} caractères`,
      );
    }
    return new Pseudo(normalized);
  }

  public equals(other: Pseudo): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
