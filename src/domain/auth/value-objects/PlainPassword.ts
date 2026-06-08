import { WeakPasswordError } from "@domain/auth/errors/WeakPasswordError";

/**
 * Value Object représentant un mot de passe **en clair valide** vis-à-vis de la politique
 * de robustesse du métier.
 *
 * Il garantit l'invariant « ce mot de passe respecte la politique » avant tout hachage.
 * Il ne doit jamais être persisté : il sert uniquement de point de validation en entrée,
 * puis sa valeur est transmise au `IPasswordHasher` pour produire un `HashedPassword`.
 */
export class PlainPassword {
  /** Longueur minimale exigée pour un mot de passe. */
  private static readonly MIN_LENGTH = 8;

  /** Longueur maximale acceptée (borne de sûreté, bcrypt traite jusqu'à 72 octets). */
  private static readonly MAX_LENGTH = 72;

  /** Le mot de passe doit contenir au moins un chiffre ou un caractère non alphabétique. */
  private static readonly COMPLEXITY_REGEX = /[^a-zA-Z]/;

  /**
   * @param value - Le mot de passe en clair déjà validé.
   *                Constructeur privé : passer par {@link PlainPassword.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `PlainPassword` après validation de la politique de robustesse.
   *
   * @param raw - Le mot de passe en clair brut.
   * @returns Une instance valide de `PlainPassword`.
   * @throws {WeakPasswordError} Si le mot de passe ne respecte pas la politique.
   */
  public static create(raw: string): PlainPassword {
    // Garde défensive : une entrée absente ou non textuelle (corps de requête vide,
    // type incorrect) est traitée comme un mot de passe invalide (→ 400) plutôt que
    // de laisser l'accès à `.length` lever un `TypeError` (→ 500).
    if (typeof raw !== "string") {
      throw new WeakPasswordError("un mot de passe est requis.");
    }

    if (raw.length < PlainPassword.MIN_LENGTH) {
      throw new WeakPasswordError(
        `il doit contenir au moins ${PlainPassword.MIN_LENGTH} caractères.`,
      );
    }

    if (raw.length > PlainPassword.MAX_LENGTH) {
      throw new WeakPasswordError(
        `il ne doit pas dépasser ${PlainPassword.MAX_LENGTH} caractères.`,
      );
    }

    if (!PlainPassword.COMPLEXITY_REGEX.test(raw)) {
      throw new WeakPasswordError("il doit contenir au moins un chiffre ou un caractère spécial.");
    }

    return new PlainPassword(raw);
  }
}
