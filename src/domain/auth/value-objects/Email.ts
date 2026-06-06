import { InvalidEmailError } from "@domain/auth/errors/InvalidEmailError";

/**
 * Value Object représentant une adresse e-mail **valide et normalisée**.
 *
 * L'invariant « cet e-mail est syntaxiquement valide » est garanti par la construction :
 * il est impossible d'obtenir une instance d'`Email` mal formée. La valeur est normalisée
 * (trim + minuscules) pour assurer l'unicité métier (`A@B.com` == `a@b.com`).
 *
 * Le VO est immuable : sa valeur ne peut pas changer après construction.
 */
export class Email {
  /** Expression régulière de validation (volontairement pragmatique, pas exhaustive RFC). */
  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * @param value - L'adresse e-mail normalisée et déjà validée.
   *                Le constructeur est privé : on passe obligatoirement par {@link Email.create}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Crée un `Email` à partir d'une chaîne brute, après normalisation et validation.
   *
   * @param raw - La chaîne brute saisie (potentiellement avec espaces/majuscules).
   * @returns Une instance d'`Email` garantie valide.
   * @throws {InvalidEmailError} Si la valeur normalisée ne respecte pas le format attendu.
   */
  public static create(raw: string): Email {
    const normalized = Email.normalize(raw);

    if (!Email.isValid(normalized)) {
      throw new InvalidEmailError(raw);
    }

    return new Email(normalized);
  }

  /**
   * Normalise une chaîne d'e-mail : supprime les espaces de bord et passe en minuscules.
   *
   * @param raw - La chaîne brute.
   * @returns La chaîne normalisée.
   */
  private static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  /**
   * Indique si une chaîne déjà normalisée respecte le format d'un e-mail.
   *
   * @param normalized - La chaîne à tester.
   * @returns `true` si le format est valide, `false` sinon.
   */
  private static isValid(normalized: string): boolean {
    return Email.EMAIL_PATTERN.test(normalized);
  }

  /**
   * Compare deux value objects `Email` par valeur (égalité structurelle).
   *
   * @param other - L'autre e-mail à comparer.
   * @returns `true` si les deux représentent la même adresse.
   */
  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  /**
   * @returns La représentation textuelle de l'e-mail (sa valeur normalisée).
   */
  public toString(): string {
    return this.value;
  }
}
