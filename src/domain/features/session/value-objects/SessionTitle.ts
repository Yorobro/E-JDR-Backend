import { InvalidSessionTitleError } from "@domain/features/session/errors/InvalidSessionTitleError";

/**
 * Value Object représentant un **titre de session valide et normalisé**.
 *
 * L'invariant « ce titre respecte les règles métier » est garanti par la construction :
 * il est impossible d'obtenir une instance de `SessionTitle` vide ou trop longue. La valeur
 * est normalisée (suppression des espaces de bord) pour éviter les titres uniquement composés
 * d'espaces et homogénéiser l'affichage.
 *
 * Le VO est immuable : sa valeur ne peut pas changer après construction.
 */
export class SessionTitle {
  /** Longueur maximale autorisée (alignée sur la colonne `sessions.title VARCHAR(120)`). */
  private static readonly MAX_LENGTH = 120;

  /**
   * @param value - Le titre normalisé et déjà validé.
   *                Le constructeur est privé : on passe obligatoirement par {@link SessionTitle.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `SessionTitle` à partir d'une chaîne brute, après normalisation et validation.
   *
   * @param raw - La chaîne brute saisie (potentiellement avec espaces de bord).
   * @returns Une instance de `SessionTitle` garantie valide.
   * @throws {InvalidSessionTitleError} Si la valeur est absente, vide après normalisation,
   *                                    ou dépasse la longueur maximale.
   */
  public static create(raw: string): SessionTitle {
    // Garde défensive : une entrée absente ou non textuelle (corps de requête vide,
    // type incorrect) est une violation d'invariant métier, pas une erreur technique.
    // On la transforme donc en `InvalidSessionTitleError` (→ 400) plutôt que de laisser
    // `trim` lever un `TypeError` (→ 500).
    if (typeof raw !== "string") {
      throw new InvalidSessionTitleError("valeur absente ou de type incorrect");
    }

    const normalized = raw.trim();

    if (normalized.length === 0) {
      throw new InvalidSessionTitleError("le titre ne peut pas être vide");
    }

    if (normalized.length > SessionTitle.MAX_LENGTH) {
      throw new InvalidSessionTitleError(
        `le titre ne peut pas dépasser ${SessionTitle.MAX_LENGTH} caractères`,
      );
    }

    return new SessionTitle(normalized);
  }

  /**
   * Compare deux value objects `SessionTitle` par valeur (égalité structurelle).
   *
   * @param other - L'autre titre à comparer.
   * @returns `true` si les deux représentent le même titre.
   */
  public equals(other: SessionTitle): boolean {
    return this.value === other.value;
  }

  /**
   * @returns La représentation textuelle du titre (sa valeur normalisée).
   */
  public toString(): string {
    return this.value;
  }
}
