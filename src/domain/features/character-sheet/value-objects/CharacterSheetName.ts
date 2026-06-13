import { InvalidCharacterSheetNameError } from "@domain/features/character-sheet/errors/InvalidCharacterSheetNameError";

/**
 * Value Object représentant un **nom de fiche de personnage valide et normalisé**.
 *
 * L'invariant « ce nom respecte les règles métier » est garanti par la construction : il est
 * impossible d'obtenir une instance de `CharacterSheetName` vide ou trop longue. La valeur est
 * normalisée (suppression des espaces de bord). Le VO est immuable.
 */
export class CharacterSheetName {
  /** Longueur maximale autorisée (alignée sur la colonne `character_sheets.name VARCHAR(120)`). */
  private static readonly MAX_LENGTH = 120;

  /**
   * @param value - Le nom normalisé et déjà validé.
   *                Le constructeur est privé : on passe obligatoirement par {@link CharacterSheetName.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `CharacterSheetName` à partir d'une chaîne brute, après normalisation et validation.
   *
   * @param raw - La chaîne brute saisie (potentiellement avec espaces de bord).
   * @returns Une instance garantie valide.
   * @throws {InvalidCharacterSheetNameError} Si la valeur est absente, vide après normalisation,
   *                                          ou dépasse la longueur maximale.
   */
  public static create(raw: string): CharacterSheetName {
    // Garde défensive : une entrée absente ou non textuelle est une violation d'invariant
    // métier (→ 400), pas une erreur technique (→ 500).
    if (typeof raw !== "string") {
      throw new InvalidCharacterSheetNameError("valeur absente ou de type incorrect");
    }

    const normalized = raw.trim();

    if (normalized.length === 0) {
      throw new InvalidCharacterSheetNameError("le nom ne peut pas être vide");
    }

    if (normalized.length > CharacterSheetName.MAX_LENGTH) {
      throw new InvalidCharacterSheetNameError(
        `le nom ne peut pas dépasser ${CharacterSheetName.MAX_LENGTH} caractères`,
      );
    }

    return new CharacterSheetName(normalized);
  }

  /**
   * Compare deux value objects `CharacterSheetName` par valeur (égalité structurelle).
   *
   * @param other - L'autre nom à comparer.
   * @returns `true` si les deux représentent le même nom.
   */
  public equals(other: CharacterSheetName): boolean {
    return this.value === other.value;
  }

  /**
   * @returns La représentation textuelle du nom (sa valeur normalisée).
   */
  public toString(): string {
    return this.value;
  }
}
