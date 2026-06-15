import { InvalidCampaignNameError } from "@domain/features/campaign/errors/InvalidCampaignNameError";

/**
 * Value Object représentant un **nom de campagne valide et normalisé**.
 *
 * L'invariant « ce nom respecte les règles métier » est garanti par la construction :
 * il est impossible d'obtenir une instance de `CampaignName` vide ou trop longue. La valeur
 * est normalisée (suppression des espaces de bord) pour éviter les noms uniquement composés
 * d'espaces et homogénéiser l'affichage.
 *
 * Le VO est immuable : sa valeur ne peut pas changer après construction.
 */
export class CampaignName {
  /** Longueur maximale autorisée (alignée sur la colonne `campaigns.name VARCHAR(120)`). */
  private static readonly MAX_LENGTH = 120;

  /**
   * @param value - Le nom normalisé et déjà validé.
   *                Le constructeur est privé : on passe obligatoirement par {@link CampaignName.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `CampaignName` à partir d'une chaîne brute, après normalisation et validation.
   *
   * @param raw - La chaîne brute saisie (potentiellement avec espaces de bord).
   * @returns Une instance de `CampaignName` garantie valide.
   * @throws {InvalidCampaignNameError} Si la valeur est absente, vide après normalisation,
   *                                    ou dépasse la longueur maximale.
   */
  public static create(raw: string): CampaignName {
    // Garde défensive : une entrée absente ou non textuelle (corps de requête vide,
    // type incorrect) est une violation d'invariant métier, pas une erreur technique.
    // On la transforme donc en `InvalidCampaignNameError` (→ 400) plutôt que de laisser
    // `trim` lever un `TypeError` (→ 500).
    if (typeof raw !== "string") {
      throw new InvalidCampaignNameError("valeur absente ou de type incorrect");
    }

    const normalized = raw.trim();

    if (normalized.length === 0) {
      throw new InvalidCampaignNameError("le nom ne peut pas être vide");
    }

    if (normalized.length > CampaignName.MAX_LENGTH) {
      throw new InvalidCampaignNameError(
        `le nom ne peut pas dépasser ${CampaignName.MAX_LENGTH} caractères`,
      );
    }

    return new CampaignName(normalized);
  }

  /**
   * Compare deux value objects `CampaignName` par valeur (égalité structurelle).
   *
   * @param other - L'autre nom à comparer.
   * @returns `true` si les deux représentent le même nom.
   */
  public equals(other: CampaignName): boolean {
    return this.value === other.value;
  }

  /**
   * @returns La représentation textuelle du nom (sa valeur normalisée).
   */
  public toString(): string {
    return this.value;
  }
}
