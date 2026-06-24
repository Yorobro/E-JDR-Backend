import { InvalidSessionParticipantStatusError } from "@domain/features/session/errors/InvalidSessionParticipantStatusError";

/**
 * Value Object représentant l'**état de la participation d'un joueur** à une session.
 *
 * ```
 * INVITED ──accept──► ACCEPTED
 *         └─refuse──► REFUSED
 * ```
 *
 * - `INVITED`  : le MJ a invité le joueur ; on attend sa réponse.
 * - `ACCEPTED` : le joueur a rejoint le lobby et choisi sa fiche de personnage.
 * - `REFUSED`  : le joueur a décliné l'invitation.
 *
 * Les transitions sont portées par l'entité {@link SessionParticipant}
 * (`accept`, `refuse`) ; ce VO n'expose que la valeur et des prédicats de lecture.
 */
export class SessionParticipantStatus {
  /** Invitation envoyée, en attente de réponse. */
  public static readonly INVITED = new SessionParticipantStatus("INVITED");
  /** Le joueur a accepté et choisi sa fiche. */
  public static readonly ACCEPTED = new SessionParticipantStatus("ACCEPTED");
  /** Le joueur a refusé l'invitation. */
  public static readonly REFUSED = new SessionParticipantStatus("REFUSED");

  /**
   * @param value - La valeur symbolique du statut.
   *                Constructeur privé : on passe par {@link SessionParticipantStatus.create}
   *                ou les singletons.
   */
  private constructor(public readonly value: string) {}

  /**
   * Reconstruit un `SessionParticipantStatus` depuis sa valeur brute
   * (ex : colonne `session_participants.status`).
   *
   * @param raw - La valeur stockée.
   * @returns Le singleton correspondant.
   * @throws {InvalidSessionParticipantStatusError} Si la valeur est inconnue.
   */
  public static create(raw: string): SessionParticipantStatus {
    switch (raw) {
      case "INVITED":
        return SessionParticipantStatus.INVITED;
      case "ACCEPTED":
        return SessionParticipantStatus.ACCEPTED;
      case "REFUSED":
        return SessionParticipantStatus.REFUSED;
      default:
        throw new InvalidSessionParticipantStatusError(raw);
    }
  }

  /** @returns `true` si le joueur est encore au statut `INVITED` (n'a pas répondu). */
  public isInvited(): boolean {
    return this.value === "INVITED";
  }

  /** @returns `true` si le joueur a accepté. */
  public isAccepted(): boolean {
    return this.value === "ACCEPTED";
  }

  /** @returns `true` si le joueur a refusé. */
  public isRefused(): boolean {
    return this.value === "REFUSED";
  }

  /**
   * Compare deux statuts par valeur (égalité structurelle).
   *
   * @param other - L'autre statut à comparer.
   * @returns `true` s'ils représentent le même statut.
   */
  public equals(other: SessionParticipantStatus): boolean {
    return this.value === other.value;
  }

  /** @returns La représentation textuelle du statut (sa valeur). */
  public toString(): string {
    return this.value;
  }
}
