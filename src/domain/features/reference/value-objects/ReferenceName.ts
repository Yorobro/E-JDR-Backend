import { InvalidReferenceNameError } from "@domain/features/reference/errors/InvalidReferenceNameError";

/**
 * Value Object représentant un **nom d'élément de référence valide et normalisé**, partagé par
 * tous les types (formation, peuple, arme, armure, compétence, équipement).
 *
 * L'invariant « ce nom respecte les règles métier » est garanti par la construction : impossible
 * d'obtenir une instance vide ou trop longue. La valeur est normalisée (suppression des espaces
 * de bord). Le VO est immuable.
 */
export class ReferenceName {
  /** Longueur maximale autorisée (alignée sur la colonne `name VARCHAR(120)` des tables de référence). */
  private static readonly MAX_LENGTH = 120;

  /**
   * @param value - Le nom normalisé et déjà validé.
   *                Le constructeur est privé : on passe obligatoirement par {@link ReferenceName.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `ReferenceName` à partir d'une chaîne brute, après normalisation et validation.
   *
   * @param raw - La chaîne brute saisie (potentiellement avec espaces de bord).
   * @returns Une instance de `ReferenceName` garantie valide.
   * @throws {InvalidReferenceNameError} Si la valeur est absente, vide après normalisation,
   *                                     ou dépasse la longueur maximale.
   */
  public static create(raw: string): ReferenceName {
    if (typeof raw !== "string") {
      throw new InvalidReferenceNameError("valeur absente ou de type incorrect");
    }

    const normalized = raw.trim();

    if (normalized.length === 0) {
      throw new InvalidReferenceNameError("le nom ne peut pas être vide");
    }

    if (normalized.length > ReferenceName.MAX_LENGTH) {
      throw new InvalidReferenceNameError(
        `le nom ne peut pas dépasser ${ReferenceName.MAX_LENGTH} caractères`,
      );
    }

    return new ReferenceName(normalized);
  }

  /**
   * Compare deux value objects `ReferenceName` par valeur (égalité structurelle).
   *
   * @param other - L'autre nom à comparer.
   * @returns `true` si les deux représentent le même nom.
   */
  public equals(other: ReferenceName): boolean {
    return this.value === other.value;
  }

  /**
   * @returns La représentation textuelle du nom (sa valeur normalisée).
   */
  public toString(): string {
    return this.value;
  }
}
