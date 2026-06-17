import { InvalidSessionDateError } from "@domain/features/session/errors/InvalidSessionDateError";

/**
 * Value Object représentant la **date d'une session** (jour calendaire, sans heure).
 *
 * L'invariant « cette date est un jour calendaire réel » est garanti par la construction à
 * partir d'une chaîne `YYYY-MM-DD`. En interne, la date est stockée comme un `Date` à minuit
 * **UTC** afin que la conversion aller-retour (`toIsoDate`) soit stable et indépendante du
 * fuseau horaire du serveur.
 *
 * Le VO est immuable : sa valeur ne peut pas changer après construction.
 */
export class SessionDate {
  /** Format strict attendu en entrée : année-mois-jour. */
  private static readonly PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * @param value - La date validée (minuit UTC).
   *                Le constructeur est privé : on passe par {@link SessionDate.create} ou
   *                {@link SessionDate.fromDate}.
   */
  private constructor(public readonly value: Date) {}

  /**
   * Crée un `SessionDate` à partir d'une chaîne brute `YYYY-MM-DD`.
   *
   * @param raw - La chaîne brute saisie.
   * @returns Une instance de `SessionDate` garantie valide.
   * @throws {InvalidSessionDateError} Si le format est incorrect ou la date inexistante
   *                                   (ex : `2026-02-30`).
   */
  public static create(raw: string): SessionDate {
    if (typeof raw !== "string" || !SessionDate.PATTERN.test(raw)) {
      throw new InvalidSessionDateError("format attendu AAAA-MM-JJ");
    }

    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new InvalidSessionDateError("date inexistante");
    }

    // Garde-fou contre la normalisation silencieuse de JS (ex : 2026-02-30 → 2026-03-02).
    if (SessionDate.toIso(parsed) !== raw) {
      throw new InvalidSessionDateError("date inexistante");
    }

    return new SessionDate(parsed);
  }

  /**
   * Reconstruit un `SessionDate` à partir d'un `Date` déjà persisté (lecture BDD).
   *
   * @param date - La date issue de la base.
   * @returns Une instance de `SessionDate`.
   */
  public static fromDate(date: Date): SessionDate {
    return new SessionDate(date);
  }

  /**
   * @returns La date au format `YYYY-MM-DD` (composantes UTC).
   */
  public toIsoDate(): string {
    return SessionDate.toIso(this.value);
  }

  private static toIso(date: Date): string {
    const year = date.getUTCFullYear().toString().padStart(4, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
